using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.Users
{
    public class UpdateUsernameDto
    {
        [Required]
        [MinLength(3, ErrorMessage = "Username must be at least 3 characters.")]
        [MaxLength(20, ErrorMessage = "Username cannot exceed 20 characters.")]
        [RegularExpression(@"^[a-zA-Z0-9_-]+$",
            ErrorMessage = "Username can only contain letters, numbers, underscores and hyphens.")]
        public string UserName { get; set; } = string.Empty;
    }
}