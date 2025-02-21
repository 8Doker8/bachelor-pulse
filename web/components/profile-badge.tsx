type ProfileBadgeProps = {
  imageUrl: string;
  message: string;
};

export default function ProfileBadge({ imageUrl, message }: ProfileBadgeProps) {
    return (
      <div className="flex flex-row overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm h-[300px]">
        {/* Left Column: Doctor Image */}
        <div className="flex-shrink-0 w-1/2 h-full">
          <img
            className="h-full w-full object-contain"
            src={imageUrl || "https://via.placeholder.com/400"}
            alt="Doctor"
          />
        </div>
  
        {/* Right Column: Motivational Quote */}
        <div className="flex flex-1 items-center justify-center p-6">
          <blockquote className="text-2xl font-semibold text-zinc-950 dark:text-white text-left leading-relaxed italic relative">
            {message || "Commit to your health – small changes lead to big outcomes."}
          </blockquote>
        </div>
      </div>
    );
  }
  