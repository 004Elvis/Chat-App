namespace ChatAppBackend.DTOs.Admin
{
    public class AdminStatsDto
    {
        public int TotalUsers { get; set; }
        public int VerifiedUsers { get; set; }
        public int TotalRooms { get; set; }
        public int TotalGroupRooms { get; set; }
        public int TotalDirectMessageRooms { get; set; }
        public int TotalMessages { get; set; }
    }
}