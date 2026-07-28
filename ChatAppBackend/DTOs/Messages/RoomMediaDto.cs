namespace ChatAppBackend.DTOs.Messages
{
    public class MediaItemDto
    {
        public int MessageId { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
        public string SenderUserName { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
    }

    public class LinkItemDto
    {
        public int MessageId { get; set; }
        public string Url { get; set; } = string.Empty;
        public string MessageContent { get; set; } = string.Empty;
        public string SenderUserName { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
    }

    public class RoomMediaDto
    {
        public List<MediaItemDto> Images { get; set; } = new();
        public List<MediaItemDto> Videos { get; set; } = new();
        public List<MediaItemDto> Documents { get; set; } = new();
        public List<LinkItemDto> Links { get; set; } = new();
    }
}