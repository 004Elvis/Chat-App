using System.Security.Claims;
using ChatAppBackend.Data;
using ChatAppBackend.DTOs.ChatRooms;
using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatRoomsController : ControllerBase
    {
        private readonly IChatRoomService _chatRoomService;
        private readonly ICloudinaryService _cloudinaryService;
        private readonly ApplicationDbContext _context;

        public ChatRoomsController(
            IChatRoomService chatRoomService,
            ICloudinaryService cloudinaryService,
            ApplicationDbContext context)
        {
            _chatRoomService = chatRoomService;
            _cloudinaryService = cloudinaryService;
            _context = context;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> GetMyRooms()
        {
            var rooms = await _chatRoomService
                .GetUserRoomsAsync(GetCurrentUserId());
            return Ok(rooms);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRoom(int id)
        {
            var room = await _chatRoomService
                .GetRoomByIdAsync(id, GetCurrentUserId());

            if (room == null)
                return NotFound(new { message = "Room not found or access denied." });

            return Ok(room);
        }

        [HttpPost]
        public async Task<IActionResult> CreateRoom([FromBody] CreateChatRoomDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var room = await _chatRoomService
                .CreateRoomAsync(dto, GetCurrentUserId());

            if (room == null)
                return BadRequest(new { message = "Failed to create room." });

            return CreatedAtAction(nameof(GetRoom), new { id = room.Id }, room);
        }

        [HttpPost("direct")]
        public async Task<IActionResult> StartDirectMessage(
            [FromBody] StartDirectMessageDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var room = await _chatRoomService
                .StartDirectMessageAsync(dto.UserId, GetCurrentUserId());

            if (room == null)
                return BadRequest(new { message =
                    "Could not start conversation with that user." });

            return Ok(room);
        }

        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(int id, [FromBody] Guid userId)
        {
            var result = await _chatRoomService
                .AddMemberAsync(id, userId, GetCurrentUserId());

            if (!result)
                return BadRequest(new { message = "Failed to add member." });

            return Ok(new { message = "Member added successfully." });
        }

        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(int id, Guid userId)
        {
            var (success, error) = await _chatRoomService
                .RemoveMemberAsync(id, userId, GetCurrentUserId());

            if (!success)
                return BadRequest(new { message = error ?? "Failed to remove member." });

            return Ok(new { message = "Member removed successfully." });
        }

        [HttpPost("{id}/members/{userId}/promote")]
        public async Task<IActionResult> PromoteToAdmin(int id, Guid userId)
        {
            var (success, error) = await _chatRoomService
                .PromoteToAdminAsync(id, userId, GetCurrentUserId());

            if (!success)
                return BadRequest(new { message = error ?? "Failed to promote member." });

            return Ok(new { message = "Member promoted to admin." });
        }

        [HttpPost("{id}/leave")]
        public async Task<IActionResult> LeaveRoom(int id)
        {
            var result = await _chatRoomService
                .LeaveRoomAsync(id, GetCurrentUserId());

            if (!result)
                return BadRequest(new { message = "Failed to leave room." });

            return Ok(new { message = "You have left the room." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRoom(int id)
        {
            var result = await _chatRoomService
                .DeleteRoomAsync(id, GetCurrentUserId());

            if (!result)
                return BadRequest(new { message =
                    "Failed to delete room. Only group admins can delete a room." });

            return Ok(new { message = "Room deleted." });
        }

        [HttpGet("{id}/messages")]
        public async Task<IActionResult> GetMessages(
            int id, [FromQuery] int? cursor, [FromQuery] int limit = 50)
        {
            var messages = await _chatRoomService
                .GetMessagesAsync(id, GetCurrentUserId(), cursor, limit);

            return Ok(messages);
        }

        [HttpPost("{id}/attachments")]
        [RequestSizeLimit(50 * 1024 * 1024)] // 50MB
        public async Task<IActionResult> UploadAttachment(int id, IFormFile file)
        {
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == id && m.UserId == GetCurrentUserId());
            if (!isMember)
                return Forbid();

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file was uploaded." });

            const long maxSizeBytes = 50 * 1024 * 1024;
            if (file.Length > maxSizeBytes)
                return BadRequest(new { message = "File must be smaller than 50MB." });

            var allowedTypes = new[]
            {
                "image/jpeg", "image/png", "image/webp", "image/gif",
                "video/mp4", "video/quicktime", "video/webm",
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "text/plain"
            };

            if (!allowedTypes.Contains(file.ContentType))
                return BadRequest(new { message =
                    "That file type isn't supported. Try an image, video, PDF, or common document format." });

            string messageType = file.ContentType.StartsWith("image/") ? "Image"
                : file.ContentType.StartsWith("video/") ? "Video"
                : "Document";

            try
            {
                using var stream = file.OpenReadStream();
                var (url, _) = await _cloudinaryService.UploadChatFileAsync(
                    stream, file.FileName, file.ContentType, id);

                return Ok(new AttachmentUploadResultDto
                {
                    FileUrl = url,
                    FileName = file.FileName,
                    FileType = file.ContentType,
                    FileSizeBytes = file.Length,
                    MessageType = messageType
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Attachment upload error: {ex.Message}");
                return StatusCode(500, new { message =
                    "Could not upload the file right now. Please try again." });
            }
        }

        [HttpGet("{id}/media")]
        public async Task<IActionResult> GetRoomMedia(int id)
        {
            var userId = GetCurrentUserId();
            var isMember = await _context.ChatRoomMembers
                .AnyAsync(m => m.ChatRoomId == id && m.UserId == userId);
            if (!isMember)
                return Forbid();

            var messages = await _context.Messages
                .Where(m => m.ChatRoomId == id && !m.IsDeleted)
                .Include(m => m.Sender)
                .Include(m => m.Attachments)
                .OrderByDescending(m => m.SentAt)
                .ToListAsync();

            var result = new RoomMediaDto();
            var urlPattern = new System.Text.RegularExpressions.Regex(
                @"(https?://[^\s]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            foreach (var m in messages)
            {
                var attachment = m.Attachments.FirstOrDefault();
                if (attachment != null)
                {
                    var item = new MediaItemDto
                    {
                        MessageId = m.Id,
                        FileUrl = attachment.FileUrl,
                        FileName = attachment.FileName,
                        FileType = attachment.FileType,
                        FileSizeBytes = attachment.FileSizeBytes,
                        SenderUserName = m.Sender.UserName,
                        SentAt = m.SentAt
                    };

                    if (m.MessageType == "Image") result.Images.Add(item);
                    else if (m.MessageType == "Video") result.Videos.Add(item);
                    else result.Documents.Add(item);
                }
                else if (!string.IsNullOrWhiteSpace(m.Content))
                {
                    foreach (System.Text.RegularExpressions.Match match in urlPattern.Matches(m.Content))
                    {
                        result.Links.Add(new LinkItemDto
                        {
                            MessageId = m.Id,
                            Url = match.Value,
                            MessageContent = m.Content,
                            SenderUserName = m.Sender.UserName,
                            SentAt = m.SentAt
                        });
                    }
                }
            }

            return Ok(result);
        }
    }
}