using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.ChatRooms
{
    public class StartDirectMessageDto
    {
        [Required]
        public Guid UserId { get; set; }
    }
}