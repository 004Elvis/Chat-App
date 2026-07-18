using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace ChatAppBackend.Services
{
    public interface ICloudinaryService
    {
        Task<string> UploadAvatarAsync(Stream fileStream, string fileName, Guid userId);
    }

    public class CloudinaryService : ICloudinaryService
    {
        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration config)
        {
            var settings = config.GetSection("CloudinarySettings");
            var account = new Account(
                settings["CloudName"],
                settings["ApiKey"],
                settings["ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
        }

        public async Task<string> UploadAvatarAsync(
            Stream fileStream, string fileName, Guid userId)
        {
            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(fileName, fileStream),
                // One folder per user - re-uploading always overwrites
                // the same public ID rather than piling up old avatars.
                PublicId = $"chatapp/avatars/{userId}",
                Overwrite = true,
                // Square crop centered on the detected face where possible,
                // falls back to a normal center crop otherwise.
                Transformation = new Transformation()
                    .Width(300).Height(300).Crop("fill").Gravity("face")
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
                throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

            return result.SecureUrl.ToString();
        }
    }
}