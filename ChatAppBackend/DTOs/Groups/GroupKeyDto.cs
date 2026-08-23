namespace ChatAppBackend.DTOs.Groups
{
    public class GroupKeyResponseDto
    {
        public int KeyVersion { get; set; }
        public string EncryptedKey { get; set; } = string.Empty;
        public string DistributorPublicKey { get; set; } = string.Empty;
    }

    public class GroupKeyEntryInputDto
    {
        public Guid UserId { get; set; }
        public string EncryptedKey { get; set; } = string.Empty;
    }

    public class DistributeGroupKeyDto
    {
        public int Version { get; set; }
        public string DistributorPublicKey { get; set; } = string.Empty;
        public List<GroupKeyEntryInputDto> Entries { get; set; } = new();
    }

    public class GroupKeyVersionInfoDto
{
    public int LatestVersion { get; set; }
    public List<Guid> MemberUserIdsWithKey { get; set; } = new();
}
}