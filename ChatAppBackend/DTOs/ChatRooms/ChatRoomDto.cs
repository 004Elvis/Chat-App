using ChatAppBackend.DTOs.Messages;
using ChatAppBackend.DTOs.Users;

namespace ChatAppBackend.DTOs.ChatRooms
{
    public class ChatRoomDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsGroup { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<UserDto> Members { get; set; } = new List<UserDto>();
        public int UnreadCount { get; set; }
        public MessageDto? LastMessage { get; set; }
    }
}