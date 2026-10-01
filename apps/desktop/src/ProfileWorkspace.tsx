import { useState } from "react";
import ProfileEditor from "./ProfileEditor";
import ProfileReview from "./ProfileReview";

export default function ProfileWorkspace() {
  const [view, setView] = useState<"profile" | "evidence">("profile");
  const [reviewOpened, setReviewOpened] = useState(false);
  const [profileRefresh, setProfileRefresh] = useState(0);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  return (
    <>
      <nav className="identity-navigation" aria-label="Identity channels">
        <button
          type="button"
          aria-current={view === "profile" ? "page" : undefined}
          onClick={() => setView("profile")}
        >
          Saved profile
        </button>
        <button
          type="button"
          aria-current={view === "evidence" ? "page" : undefined}
          onClick={() => {
            setReviewOpened(true);
            setView("evidence");
          }}
        >
          Evidence review
        </button>
      </nav>
      <div hidden={view !== "profile"}>
        <ProfileEditor refresh={profileRefresh} onSaved={() => setReviewRefresh((n) => n + 1)} />
      </div>
      {reviewOpened && (
        <div hidden={view !== "evidence"}>
          <ProfileReview refresh={reviewRefresh} onSaved={() => setProfileRefresh((n) => n + 1)} />
        </div>
      )}
    </>
  );
}
