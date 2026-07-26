namespace ChatAppBackend.DTOs.Messages
{
    public class ReplyPreviewDto
    {
        public int Id { get; set; }
        public string SenderUserName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
    }
}