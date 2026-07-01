using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.ChatRooms
{
    public class CreateChatRoomDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public bool IsGroup { get; set; } = true;

        public List<Guid> MemberIds { get; set; } = new List<Guid>();
    }
}