using System.ComponentModel.DataAnnotations;

namespace ChatAppBackend.DTOs.Users
{
    public class UpdatePublicKeyDto
    {
        [Required]
        public string PublicKey { get; set; } = string.Empty;
    }
}