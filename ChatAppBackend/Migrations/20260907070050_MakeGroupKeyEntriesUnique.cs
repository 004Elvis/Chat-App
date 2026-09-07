using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatAppBackend.Migrations
{
    /// <inheritdoc />
    public partial class MakeGroupKeyEntriesUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GroupKeyEntries_ChatRoomId_KeyVersion_UserId",
                table: "GroupKeyEntries");

            migrationBuilder.CreateIndex(
                name: "IX_GroupKeyEntries_ChatRoomId_KeyVersion_UserId",
                table: "GroupKeyEntries",
                columns: new[] { "ChatRoomId", "KeyVersion", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GroupKeyEntries_ChatRoomId_KeyVersion_UserId",
                table: "GroupKeyEntries");

            migrationBuilder.CreateIndex(
                name: "IX_GroupKeyEntries_ChatRoomId_KeyVersion_UserId",
                table: "GroupKeyEntries",
                columns: new[] { "ChatRoomId", "KeyVersion", "UserId" });
        }
    }
}
