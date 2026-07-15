using ChatAppBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatAppBackend.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options) { }

        // One DbSet per entity = one table per entity
        public DbSet<User> Users { get; set; }
        public DbSet<ChatRoom> ChatRooms { get; set; }
        public DbSet<ChatRoomMember> ChatRoomMembers { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<MessageAttachment> MessageAttachments { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
        public DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.HasIndex(u => u.Email).IsUnique();
                entity.HasIndex(u => u.UserName).IsUnique();
                entity.Property(u => u.UserName).HasMaxLength(50).IsRequired();
                entity.Property(u => u.Email).HasMaxLength(100).IsRequired();
                entity.Property(u => u.PasswordHash).IsRequired();
            });

            // ChatRoom
            modelBuilder.Entity<ChatRoom>(entity =>
            {
                entity.HasKey(r => r.Id);
                entity.Property(r => r.Name).HasMaxLength(100).IsRequired();
                entity.HasOne(r => r.CreatedBy)
                      .WithMany(u => u.CreatedRooms)
                      .HasForeignKey(r => r.CreatedByUserId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // ChatRoomMember
            modelBuilder.Entity<ChatRoomMember>(entity =>
            {
                entity.HasKey(m => m.Id);
                entity.HasIndex(m => new { m.ChatRoomId, m.UserId }).IsUnique();
                entity.HasOne(m => m.ChatRoom)
                      .WithMany(r => r.Members)
                      .HasForeignKey(m => m.ChatRoomId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(m => m.User)
                      .WithMany(u => u.ChatRoomMembers)
                      .HasForeignKey(m => m.UserId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(m => m.LastReadMessage)
                      .WithMany()
                      .HasForeignKey(m => m.LastReadMessageId)
                      .OnDelete(DeleteBehavior.Restrict)
                      .IsRequired(false);
            });

            // Message
            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasKey(m => m.Id);
                entity.Property(m => m.Content).HasMaxLength(4000);
                entity.Property(m => m.MessageType).HasMaxLength(20).HasDefaultValue("Text");
                entity.HasOne(m => m.ChatRoom)
                      .WithMany(r => r.Messages)
                      .HasForeignKey(m => m.ChatRoomId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(m => m.Sender)
                      .WithMany(u => u.Messages)
                      .HasForeignKey(m => m.SenderId)
                      .OnDelete(DeleteBehavior.Restrict);

                // Composite index for fast history queries
                entity.HasIndex(m => new { m.ChatRoomId, m.SentAt });
            });

            // MessageAttachment
            modelBuilder.Entity<MessageAttachment>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.HasOne(a => a.Message)
                      .WithMany(m => m.Attachments)
                      .HasForeignKey(a => a.MessageId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}