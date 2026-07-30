using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace ChatAppBackend.Services
{
    public interface ICloudinaryService
    {
        Task<string> UploadAvatarAsync(Stream fileStream, string fileName, Guid userId);
        Task<(string Url, string ResourceType)> UploadChatFileAsync(
            Stream fileStream, string fileName, string contentType, int roomId);
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
                PublicId = $"chatapp/avatars/{userId}",
                Overwrite = true,
                Transformation = new Transformation()
                    .Width(300).Height(300).Crop("fill").Gravity("face")
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
                throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

            return result.SecureUrl.ToString();
        }

        public async Task<(string Url, string ResourceType)> UploadChatFileAsync(
            Stream fileStream, string fileName, string contentType, int roomId)
        {
            var publicId = $"chatapp/rooms/{roomId}/{Guid.NewGuid()}";

            if (contentType.StartsWith("image/"))
            {
                var result = await _cloudinary.UploadAsync(new ImageUploadParams
                {
                    File = new FileDescription(fileName, fileStream),
                    PublicId = publicId,
                    Transformation = new Transformation()
                        .Width(1600).Height(1600).Crop("limit")
                });

                if (result.Error != null)
                    throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

                return (result.SecureUrl.ToString(), "image");
            }

            if (contentType.StartsWith("video/") || contentType.StartsWith("audio/"))
            {
                var result = await _cloudinary.UploadAsync(new VideoUploadParams
                {
                    File = new FileDescription(fileName, fileStream),
                    PublicId = publicId
                });

                if (result.Error != null)
                    throw new Exception($"Cloudinary upload failed: {result.Error.Message}");

                return (result.SecureUrl.ToString(), "video");
            }

            var rawResult = await _cloudinary.UploadAsync(new RawUploadParams
            {
                File = new FileDescription(fileName, fileStream),
                PublicId = publicId
            });

            if (rawResult.Error != null)
                throw new Exception($"Cloudinary upload failed: {rawResult.Error.Message}");

            return (rawResult.SecureUrl.ToString(), "raw");
        }
    }
}