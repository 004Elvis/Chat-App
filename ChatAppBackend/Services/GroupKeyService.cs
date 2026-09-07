using ChatAppBackend.Data;
using ChatAppBackend.DTOs.Groups;
using ChatAppBackend.Hubs;
using ChatAppBackend.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Services
{
    public interface IGroupKeyService
    {
        Task<List<GroupKeyResponseDto>> GetMyKeysAsync(
            int roomId,
            Guid userId);

        Task<GroupKeyVersionInfoDto> GetVersionInfoAsync(
            int roomId);

        Task<(bool Success, string? Error)> DistributeKeyAsync(
            int roomId,
            Guid requesterId,
            DistributeGroupKeyDto dto);
    }

    public class GroupKeyService : IGroupKeyService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public GroupKeyService(
            ApplicationDbContext context,
            IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<List<GroupKeyResponseDto>> GetMyKeysAsync(
            int roomId,
            Guid userId)
        {
            var isMember = await _context.ChatRoomMembers.AnyAsync(
                m => m.ChatRoomId == roomId && m.UserId == userId);

            if (!isMember)
                return new List<GroupKeyResponseDto>();

            return await _context.GroupKeyEntries
                .Where(k =>
                    k.ChatRoomId == roomId &&
                    k.UserId == userId)
                .OrderBy(k => k.KeyVersion)
                .Select(k => new GroupKeyResponseDto
                {
                    KeyVersion = k.KeyVersion,
                    EncryptedKey = k.EncryptedKey,
                    DistributorPublicKey = k.DistributorPublicKey
                })
                .ToListAsync();
        }

        public async Task<GroupKeyVersionInfoDto> GetVersionInfoAsync(
            int roomId)
        {
            var latestVersion = await _context.GroupKeyEntries
                .Where(k => k.ChatRoomId == roomId)
                .Select(k => (int?)k.KeyVersion)
                .OrderByDescending(v => v)
                .FirstOrDefaultAsync() ?? 0;

            if (latestVersion == 0)
            {
                return new GroupKeyVersionInfoDto
                {
                    LatestVersion = 0,
                    MemberUserIdsWithKey = new List<Guid>()
                };
            }

            var memberIdsWithKey = await _context.GroupKeyEntries
                .Where(k =>
                    k.ChatRoomId == roomId &&
                    k.KeyVersion == latestVersion)
                .Select(k => k.UserId)
                .Distinct()
                .ToListAsync();

            return new GroupKeyVersionInfoDto
            {
                LatestVersion = latestVersion,
                MemberUserIdsWithKey = memberIdsWithKey
            };
        }

        public async Task<(bool Success, string? Error)> DistributeKeyAsync(
            int roomId,
            Guid requesterId,
            DistributeGroupKeyDto dto)
        {
            if (dto.Version <= 0)
                return (false, "Invalid group key version.");

            if (string.IsNullOrWhiteSpace(dto.DistributorPublicKey))
                return (false, "Distributor public key is required.");

            if (dto.Entries == null || dto.Entries.Count == 0)
                return (false, "At least one group key entry is required.");

            var isAdmin = await _context.ChatRoomMembers.AnyAsync(
                m =>
                    m.ChatRoomId == roomId &&
                    m.UserId == requesterId &&
                    m.Role == "Admin");

            if (!isAdmin)
                return (false, "Only group admins can distribute encryption keys.");

            var currentMemberIds = await _context.ChatRoomMembers
                .Where(m => m.ChatRoomId == roomId)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync();

            if (currentMemberIds.Count == 0)
                return (false, "The group has no members.");

            var incomingUserIds = dto.Entries
                .Select(e => e.UserId)
                .Distinct()
                .ToList();

            if (incomingUserIds.Count != dto.Entries.Count)
                return (false, "Duplicate recipients were provided.");

            var invalidRecipients = incomingUserIds
                .Except(currentMemberIds)
                .ToList();

            if (invalidRecipients.Count > 0)
            {
                return (
                    false,
                    "A group key cannot be distributed to a user who is not a current member."
                );
            }

            await using var transaction =
                await _context.Database.BeginTransactionAsync();

            try
            {
                var currentMaxVersion = await _context.GroupKeyEntries
                    .Where(k => k.ChatRoomId == roomId)
                    .Select(k => (int?)k.KeyVersion)
                    .OrderByDescending(v => v)
                    .FirstOrDefaultAsync() ?? 0;

                var isFirstKey =
                    currentMaxVersion == 0 &&
                    dto.Version == 1;

                var isRotation =
                    currentMaxVersion > 0 &&
                    dto.Version == currentMaxVersion + 1;

                var isCurrentVersionRepair =
                    currentMaxVersion > 0 &&
                    dto.Version == currentMaxVersion;

                if (!isFirstKey &&
                    !isRotation &&
                    !isCurrentVersionRepair)
                {
                    await transaction.RollbackAsync();

                    return (
                        false,
                        "Key version out of sync. Please refresh and retry."
                    );
                }

                if (isFirstKey || isRotation)
                {
                    var expectedIds = currentMemberIds
                        .OrderBy(id => id)
                        .ToList();

                    var providedIds = incomingUserIds
                        .OrderBy(id => id)
                        .ToList();

                    if (!expectedIds.SequenceEqual(providedIds))
                    {
                        await transaction.RollbackAsync();

                        return (
                            false,
                            "A new group key version must be distributed to every current group member."
                        );
                    }

                    var existingVersionEntries = await _context.GroupKeyEntries
                        .Where(k =>
                            k.ChatRoomId == roomId &&
                            k.KeyVersion == dto.Version)
                        .AnyAsync();

                    if (existingVersionEntries)
                    {
                        await transaction.RollbackAsync();

                        return (
                            false,
                            "This group key version already exists. Please refresh and retry."
                        );
                    }

                    var createdAt = DateTime.UtcNow;

                    var entries = dto.Entries
                        .Select(e => new GroupKeyEntry
                        {
                            ChatRoomId = roomId,
                            KeyVersion = dto.Version,
                            UserId = e.UserId,
                            EncryptedKey = e.EncryptedKey,
                            DistributorPublicKey = dto.DistributorPublicKey,
                            CreatedAt = createdAt
                        })
                        .ToList();

                    _context.GroupKeyEntries.AddRange(entries);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    await _hubContext
                        .Clients
                        .Group(roomId.ToString())
                        .SendAsync(
                            "GroupKeyRotated",
                            roomId,
                            dto.Version);

                    return (true, null);
                }

                var existingEntries = await _context.GroupKeyEntries
                    .Where(k =>
                        k.ChatRoomId == roomId &&
                        k.KeyVersion == dto.Version)
                    .ToListAsync();

                var existingUserIds = existingEntries
                    .Select(e => e.UserId)
                    .ToHashSet();

                var newEntries = dto.Entries
                    .Where(e => !existingUserIds.Contains(e.UserId))
                    .Select(e => new GroupKeyEntry
                    {
                        ChatRoomId = roomId,
                        KeyVersion = dto.Version,
                        UserId = e.UserId,
                        EncryptedKey = e.EncryptedKey,
                        DistributorPublicKey = dto.DistributorPublicKey,
                        CreatedAt = DateTime.UtcNow
                    })
                    .ToList();

                if (newEntries.Count > 0)
                    _context.GroupKeyEntries.AddRange(newEntries);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                var finalMemberIds = await _context.GroupKeyEntries
                    .Where(k =>
                        k.ChatRoomId == roomId &&
                        k.KeyVersion == dto.Version)
                    .Select(k => k.UserId)
                    .Distinct()
                    .ToListAsync();

                var hasCompleteVersion =
                    currentMemberIds
                        .OrderBy(id => id)
                        .SequenceEqual(
                            finalMemberIds
                                .OrderBy(id => id));

                if (hasCompleteVersion)
                {
                    await _hubContext
                        .Clients
                        .Group(roomId.ToString())
                        .SendAsync(
                            "GroupKeyAvailable",
                            roomId,
                            dto.Version);
                }

                return (true, null);
            }
            catch (DbUpdateException ex)
            {
                await transaction.RollbackAsync();

                return (
                    false,
                    $"Could not save group encryption keys: {ex.GetBaseException().Message}"
                );
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}