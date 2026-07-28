namespace ChatAppBackend.DTOs.Messages
{
    public class AttachmentDto
    {
        public int Id { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
    }
}