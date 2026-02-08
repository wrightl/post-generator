using FluentValidation;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Validators;

public class CreatePostRequestValidator : AbstractValidator<CreatePostRequest>
{
    public CreatePostRequestValidator()
    {
        RuleFor(x => x.TopicSummary).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Platform)
            .NotEmpty()
            .Must(v => Enum.TryParse<PostPlatform>(v, true, out _))
            .WithMessage("Platform must be one of: LinkedIn, Skool, Instagram, Bluesky, Facebook, TikTok");
        RuleFor(x => x.Content).MaximumLength(50_000);
        RuleFor(x => x.Script).MaximumLength(20_000);
        RuleFor(x => x.Tone).MaximumLength(100);
        RuleFor(x => x.Length).MaximumLength(50);
    }
}
