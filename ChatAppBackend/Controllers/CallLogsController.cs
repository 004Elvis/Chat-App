using System.Security.Claims;
using ChatAppBackend.DTOs.Calls;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CallLogsController : ControllerBase
    {
        private readonly ICallLogService _callLogService;

        public CallLogsController(ICallLogService callLogService)
        {
            _callLogService = callLogService;
        }

        private Guid GetCurrentUserId() =>
            Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpPost]
        public async Task<IActionResult> LogCall([FromBody] LogCallDto dto)
        {
            var result = await _callLogService.LogCallAsync(GetCurrentUserId(), dto);
            if (result == null)
                return BadRequest(new { message = "Could not log this call." });

            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetMyCallLogs([FromQuery] int? roomId)
        {
            var logs = await _callLogService.GetMyCallLogsAsync(GetCurrentUserId(), roomId);
            return Ok(logs);
        }
    }
}