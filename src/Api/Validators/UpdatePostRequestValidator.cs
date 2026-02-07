using FluentValidation;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Validators;

public class UpdatePostRequestValidator : AbstractValidator<UpdatePostRequest>
{
    public UpdatePostRequestValidator()
    {
        RuleFor(x => x.TopicSummary).MaximumLength(2000).When(x => x.TopicSummary != null);
        RuleFor(x => x.Content).MaximumLength(50_000).When(x => x.Content != null);
        RuleFor(x => x.Script).MaximumLength(20_000).When(x => x.Script != null);
        RuleFor(x => x.Tone).MaximumLength(100).When(x => x.Tone != null);
        RuleFor(x => x.Length).MaximumLength(50).When(x => x.Length != null);
        RuleFor(x => x.Status)
            .Must(v => v == null || Enum.TryParse<PostStatus>(v, true, out _))
            .WithMessage("Status must be one of: Draft, Scheduled, Published, Failed")
            .When(x => x.Status != null);
    }
}
