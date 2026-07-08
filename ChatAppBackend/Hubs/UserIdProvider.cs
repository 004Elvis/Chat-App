using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace ChatAppBackend.Hubs
{
    public class UserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection)
        {
            var userId = connection.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? connection.User?.FindFirstValue("sub")
                ?? connection.User?.FindFirstValue("nameid");

            Console.WriteLine($"=== UserIdProvider.GetUserId: {userId} ===");
            return userId;
        }
    }
}