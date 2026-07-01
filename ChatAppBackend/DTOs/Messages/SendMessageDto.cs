using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.Messages
{
    public class SendMessageDto
    {
        [Required]
        public int ChatRoomId { get; set; }

        [Required]
        [MaxLength(4000)]
        public string Content { get; set; } = string.Empty;

        public string MessageType { get; set; } = "Text";
    }
}