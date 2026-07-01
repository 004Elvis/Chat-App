namespace ChatAppBackend.DTOs.Auth
{
    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public string? AvatarUrl { get; set; }
    }
}