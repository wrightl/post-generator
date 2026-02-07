using Microsoft.EntityFrameworkCore;

namespace PostGenerator.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserSocialCredential> UserSocialCredentials => Set<UserSocialCredential>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostSeries> PostSeriesSet => Set<PostSeries>();
    public DbSet<PublishLog> PublishLogs => Set<PublishLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ExternalId).HasMaxLength(128).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.PreferredTheme).HasMaxLength(10);
            e.HasIndex(x => x.ExternalId).IsUnique();
        });

        modelBuilder.Entity<UserSocialCredential>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Platform).HasMaxLength(32).IsRequired();
            e.Property(x => x.CredentialJson).HasMaxLength(8000).IsRequired();
            e.HasIndex(x => new { x.UserId, x.Platform }).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Post>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.TopicSummary).HasMaxLength(500);
            e.Property(x => x.Content).HasMaxLength(10000);
            e.Property(x => x.Script).HasMaxLength(10000);
            e.Property(x => x.ImageUrl).HasMaxLength(2048);
            e.Property(x => x.Tone).HasMaxLength(100);
            e.Property(x => x.Length).HasMaxLength(100);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.ScheduledAt);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.Platform);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostSeries>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PublishLog>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ErrorMessage).HasMaxLength(2000);
            e.HasIndex(x => x.PostId);
            e.HasOne(x => x.Post).WithMany().HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
