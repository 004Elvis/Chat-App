using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.Auth
{
    public class ResetPasswordDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }
}