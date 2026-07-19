using System.Security.Claims;
using ChatAppBackend.DTOs.ChatRooms;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatRoomsController : ControllerBase
    {
        private readonly IChatRoomService _chatRoomService;

        public ChatRoomsController(IChatRoomService chatRoomService)
        {
            _chatRoomService = chatRoomService;
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
            var result = await _chatRoomService
                .RemoveMemberAsync(id, userId, GetCurrentUserId());

            if (!result)
                return BadRequest(new { message = "Failed to remove member." });

            return Ok(new { message = "Member removed successfully." });
        }

        [HttpGet("{id}/messages")]
        public async Task<IActionResult> GetMessages(
            int id, [FromQuery] int? cursor, [FromQuery] int limit = 50)
        {
            var messages = await _chatRoomService
                .GetMessagesAsync(id, GetCurrentUserId(), cursor, limit);

            return Ok(messages);
        }
    }
}