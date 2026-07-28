namespace ChatAppBackend.DTOs.Messages
{
    public class AttachmentInputDto
    {
        public string FileUrl { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
        public string MessageType { get; set; } = string.Empty;
    }
}