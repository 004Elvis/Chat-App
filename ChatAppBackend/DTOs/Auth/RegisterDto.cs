using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.Auth
{
    public class RegisterDto
    {
        [Required]
        [MinLength(3, ErrorMessage = "Username must be at least 3 characters.")]
        [MaxLength(20, ErrorMessage = "Username cannot exceed 20 characters.")]
        [RegularExpression(@"^[a-zA-Z0-9_-]+$",
            ErrorMessage = "Username can only contain letters, numbers, underscores and hyphens.")]
        public string UserName { get; set; } = string.Empty;

        [Required]
        [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters.")]
        [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$",
            ErrorMessage = "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character.")]
        public string Password { get; set; } = string.Empty;
    }
}