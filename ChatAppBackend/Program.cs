using System.Text;
using ChatAppBackend.Data;
using ChatAppBackend.Hubs;
using ChatAppBackend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.SignalR;
using DotNetEnv;

Env.Load(); //imediately loads the .env file

var builder = WebApplication.CreateBuilder(args);

//Inject the SendGrid key into your app configuration
var sendGridKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY");
if (!string.IsNullOrEmpty(sendGridKey))
{
    builder.Configuration["EmailSettings:SendGridApiKey"] = sendGridKey; //ensures that any dependency i have set up that binds EmailSettings will semalessly reveive the API  key from the .env file

}

var googleClientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
if (!string.IsNullOrEmpty(googleClientId))
{
    builder.Configuration["GoogleAuth:ClientId"] = googleClientId;
}

var googleClientSecret = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");
if (!string.IsNullOrEmpty(googleClientSecret))
{
    builder.Configuration["GoogleAuth:ClientSecret"] = googleClientSecret;
}

var fromEmail = Environment.GetEnvironmentVariable("FROM_EMAIL");
if (!string.IsNullOrEmpty(fromEmail))
{
    builder.Configuration["EmailSettings:FromEmail"] = fromEmail;
}

var fromName = Environment.GetEnvironmentVariable("FROM_NAME");
if (!string.IsNullOrEmpty(fromName))
{
    builder.Configuration["EmailSettings:FromName"] = fromName;
}

var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL");
if (!string.IsNullOrEmpty(frontendUrl))
{
    builder.Configuration["EmailSettings:FrontendUrl"] = frontendUrl;
}

var cloudinaryCloudName = Environment.GetEnvironmentVariable("CLOUDINARY_CLOUD_NAME");
if (!string.IsNullOrEmpty(cloudinaryCloudName))
{
    builder.Configuration["CloudinarySettings:CloudName"] = cloudinaryCloudName;
}

var cloudinaryApiKey = Environment.GetEnvironmentVariable("CLOUDINARY_API_KEY");
if (!string.IsNullOrEmpty(cloudinaryApiKey))
{
    builder.Configuration["CloudinarySettings:ApiKey"] = cloudinaryApiKey;
}

var cloudinaryApiSecret = Environment.GetEnvironmentVariable("CLOUDINARY_API_SECRET");
if (!string.IsNullOrEmpty(cloudinaryApiSecret))
{
    builder.Configuration["CloudinarySettings:ApiSecret"] = cloudinaryApiSecret;
}

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IChatRoomService, ChatRoomService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ICloudinaryService, CloudinaryService>();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"]!;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(secretKey))
    };

    // Allow SignalR to receive JWT from query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];

            // If the request is for the hub that ia ma using
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chathub"))
            {
                // Read the token out of the query string
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
})
          //Google OAuth
.AddGoogle(options =>
{
    options.ClientId = builder.Configuration["GoogleAuth:ClientId"]!;
    options.ClientSecret = builder.Configuration["GoogleAuth:ClientSecret"]!;
     options.CallbackPath = "/signin-google";
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, UserIdProvider>();
builder.Services.AddOpenApi();

// CORS — allow Angular dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Map SignalR hub
app.MapHub<ChatHub>("/chathub");

// TEMP: Test endpoint to verify hub is reachable
app.MapPost("/api/test-message", async (ApplicationDbContext db) =>
{
    var count = await db.Messages.CountAsync();
    return Results.Ok(new { messageCount = count, status = "db connected" });
});

app.Run();