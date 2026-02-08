using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PostGenerator.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalPostIdToPost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalPostId",
                table: "Posts",
                type: "nvarchar(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalPostId",
                table: "Posts");
        }
    }
}
