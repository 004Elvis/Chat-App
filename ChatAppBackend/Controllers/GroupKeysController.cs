using System.Security.Claims;
using ChatAppBackend.DTOs.Groups;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/chatrooms/{roomId}/groupkey")]
    [Authorize]
    public class GroupKeysController : ControllerBase
    {
        private readonly IGroupKeyService _groupKeyService;

        public GroupKeysController(IGroupKeyService groupKeyService)
        {
            _groupKeyService = groupKeyService;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Called by every member's client to fetch (and locally decrypt)
        // their copy of the current group key.
        [HttpGet("mine")]
            public async Task<IActionResult> GetMyKeys(int roomId)
            {
                var keys = await _groupKeyService.GetMyKeysAsync(roomId, GetCurrentUserId());
                return Ok(keys);
            }

        // Called by an admin's client before distributing a new key -
        // tells it the next version number to use and exactly which
        // members currently need a wrapped copy.
        [HttpGet("version-info")]
        public async Task<IActionResult> GetVersionInfo(int roomId)
        {
            var info = await _groupKeyService.GetVersionInfoAsync(roomId);
            return Ok(info);
        }

        // Called by an admin's client after generating a new group key
        // and wrapping a copy for every current member.
        [HttpPost("distribute")]
        public async Task<IActionResult> DistributeKey(
            int roomId, [FromBody] DistributeGroupKeyDto dto)
        {
            var (success, error) = await _groupKeyService
                .DistributeKeyAsync(roomId, GetCurrentUserId(), dto);

            if (!success)
                return BadRequest(new { message = error });

            return Ok(new { message = "Group key distributed." });
        }
    }
}