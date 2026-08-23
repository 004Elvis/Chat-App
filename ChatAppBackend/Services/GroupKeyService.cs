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
        Task<List<GroupKeyResponseDto>> GetMyKeysAsync(int roomId, Guid userId);
        Task<GroupKeyVersionInfoDto> GetVersionInfoAsync(int roomId);
        Task<(bool Success, string? Error)> DistributeKeyAsync(
            int roomId, Guid requesterId, DistributeGroupKeyDto dto);
    }

    public class GroupKeyService : IGroupKeyService
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public GroupKeyService(
            ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task<List<GroupKeyResponseDto>> GetMyKeysAsync(int roomId, Guid userId)
            {
                var isMember = await _context.ChatRoomMembers
                    .AnyAsync(m => m.ChatRoomId == roomId && m.UserId == userId);
                if (!isMember) return new List<GroupKeyResponseDto>();

            
                return await _context.GroupKeyEntries
                    .Where(k => k.ChatRoomId == roomId && k.UserId == userId)
                    .OrderBy(k => k.KeyVersion)
                    .Select(k => new GroupKeyResponseDto
                    {
                        KeyVersion = k.KeyVersion,
                        EncryptedKey = k.EncryptedKey,
                        DistributorPublicKey = k.DistributorPublicKey
                    })
                    .ToListAsync();
            }

        public async Task<GroupKeyVersionInfoDto> GetVersionInfoAsync(int roomId)
        {
            var latestVersion = await _context.GroupKeyEntries
                .Where(k => k.ChatRoomId == roomId)
                .Select(k => (int?)k.KeyVersion)
                .OrderByDescending(v => v)
                .FirstOrDefaultAsync() ?? 0;

            var memberIds = latestVersion == 0
                ? new List<Guid>()
                : await _context.GroupKeyEntries
                    .Where(k => k.ChatRoomId == roomId && k.KeyVersion == latestVersion)
                    .Select(k => k.UserId)
                    .ToListAsync();

            return new GroupKeyVersionInfoDto
            {
                LatestVersion = latestVersion,
                MemberUserIdsWithKey = memberIds
            };
        }

       public async Task<(bool Success, string? Error)> DistributeKeyAsync(
    int roomId, Guid requesterId, DistributeGroupKeyDto dto)
{
    var isAdmin = await _context.ChatRoomMembers
        .AnyAsync(m => m.ChatRoomId == roomId
            && m.UserId == requesterId
            && m.Role == "Admin");

    if (!isAdmin)
        return (false, "Only group admins can distribute encryption keys.");

    var currentMax = await _context.GroupKeyEntries
        .Where(k => k.ChatRoomId == roomId)
        .Select(k => (int?)k.KeyVersion)
        .OrderByDescending(v => v)
        .FirstOrDefaultAsync() ?? 0;

    var isRotation = dto.Version == currentMax + 1;
    var isAddingToCurrentVersion = dto.Version == currentMax && currentMax > 0;

    if (!isRotation && !isAddingToCurrentVersion)
        return (false, "Key version out of sync - please retry.");

    if (isAddingToCurrentVersion)
    {
        // Adding a member to the existing version - make sure we're not
        // creating a duplicate entry for someone who already has this
        // version's key.
        var alreadyHasEntry = await _context.GroupKeyEntries
            .Where(k => k.ChatRoomId == roomId && k.KeyVersion == dto.Version)
            .Select(k => k.UserId)
            .ToListAsync();

        dto.Entries = dto.Entries
            .Where(e => !alreadyHasEntry.Contains(e.UserId))
            .ToList();

        if (dto.Entries.Count == 0)
            return (true, null); // nothing new to add, not an error
    }

    var entries = dto.Entries.Select(e => new GroupKeyEntry
    {
        ChatRoomId = roomId,
        KeyVersion = dto.Version,
        UserId = e.UserId,
        EncryptedKey = e.EncryptedKey,
        DistributorPublicKey = dto.DistributorPublicKey,
        CreatedAt = DateTime.UtcNow
    }).ToList();

    _context.GroupKeyEntries.AddRange(entries);
    await _context.SaveChangesAsync();

    // Only a genuine rotation needs to notify everyone to refresh their
    // key cache - adding one member to the current version doesn't
    // change anything for people who already have it.
    if (isRotation)
    {
        await _hubContext.Clients.Group(roomId.ToString())
            .SendAsync("GroupKeyRotated", roomId, dto.Version);
    }

    return (true, null);
}
    }
}