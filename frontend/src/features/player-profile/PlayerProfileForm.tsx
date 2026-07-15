import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  playerProfileSchema,
  type PlayerProfile,
  type PositionGroup,
  type PositionMetrics
} from "@scoutpass/backend/contracts";

interface PlayerProfileFormProps {
  readonly value: PlayerProfile;
  readonly onChange: (profile: PlayerProfile) => void;
}

export function PlayerProfileForm({ value, onChange }: PlayerProfileFormProps) {
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const { register, reset, setValue, getValues, control } = useForm<PlayerProfile>({
    defaultValues: value,
    mode: "onChange"
  });
  const watchedProfile = useWatch({ control }) as PlayerProfile;
  const parsed = playerProfileSchema.safeParse(watchedProfile);
  const watchedProfileSnapshot = JSON.stringify(watchedProfile);
  const positionGroup = watchedProfile.football?.positionGroup ?? "forward";
  const completion = calculateCompletion(watchedProfile);

  useEffect(() => {
    reset(value);
  }, [reset, value]);

  useEffect(() => {
    const result = playerProfileSchema.safeParse(JSON.parse(watchedProfileSnapshot));
    if (result.success) {
      onChange(result.data);
    }
  }, [onChange, watchedProfileSnapshot]);

  useEffect(() => {
    const currentGroup = getValues("performance.positionSpecific.positionGroup");
    if (currentGroup !== positionGroup) {
      setValue("performance.positionSpecific", createDefaultPositionMetrics(positionGroup));
    }
  }, [getValues, positionGroup, setValue]);

  const saveDraft = () => {
    if (!parsed.success) {
      return;
    }
    localStorage.setItem("scoutpass.playerDraft", JSON.stringify(parsed.data));
    setDraftSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <section className="profile-editor" aria-labelledby="profile-title">
      <div className="profile-header">
        <div>
          <p className="eyebrow">Player profile</p>
          <h2 id="profile-title">Tell your football story</h2>
          <p className="summary">Your profile stays on this device until you choose to share it.</p>
        </div>
        <div className="section-actions">
          <button type="button" className="primary-button" onClick={saveDraft}>
            Save draft
          </button>
        </div>
      </div>

      <div className="completion">
        <span style={{ width: `${completion}%` }} />
      </div>
      <p className="muted">{completion}% profile completion · self-entered data, not verified</p>
      {draftSavedAt ? <p className="muted">Draft saved locally at {draftSavedAt}</p> : null}

      <form className="profile-form">
        <fieldset>
          <legend>
            <span>01</span> Player identity
          </legend>
          <div className="form-grid">
            <label>
              Full name
              <input {...register("football.fullName")} />
            </label>
            <label>
              Age
              <input type="number" {...register("football.age", { valueAsNumber: true })} />
            </label>
            <label>
              Country
              <input {...register("football.country")} />
            </label>
            <label>
              City
              <input {...register("football.city")} />
            </label>
            <label>
              Current team
              <input {...register("football.currentTeam")} />
            </label>
            <label>
              Height (cm)
              <input type="number" {...register("football.heightCm", { valueAsNumber: true })} />
            </label>
            <label>
              Primary position
              <input {...register("football.primaryPosition")} />
            </label>
            <label>
              Secondary position
              <input {...register("football.secondaryPosition")} />
            </label>
            <label>
              Position group
              <select {...register("football.positionGroup")}>
                <option value="goalkeeper">Goalkeeper</option>
                <option value="defender">Defender</option>
                <option value="midfielder">Midfielder</option>
                <option value="forward">Forward</option>
              </select>
            </label>
            <label>
              Dominant foot
              <select {...register("football.dominantFoot")}>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <span>02</span> Match performance
          </legend>
          <div className="form-grid performance-grid">
            <label>
              Matches
              <input
                type="number"
                {...register("performance.common.matchesPlayed", { valueAsNumber: true })}
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                {...register("performance.common.minutesPlayed", { valueAsNumber: true })}
              />
            </label>
            <label>
              Goals
              <input
                type="number"
                {...register("performance.common.goals", { valueAsNumber: true })}
              />
            </label>
            <label>
              Assists
              <input
                type="number"
                {...register("performance.common.assists", { valueAsNumber: true })}
              />
            </label>
            <label>
              Pass completion %
              <input
                type="number"
                {...register("performance.common.passCompletionPercentage", {
                  valueAsNumber: true
                })}
              />
            </label>
            <label>
              Shots on target
              <input
                type="number"
                {...register("performance.common.shotsOnTarget", { valueAsNumber: true })}
              />
            </label>
            <label>
              Yellow cards
              <input
                type="number"
                {...register("performance.common.yellowCards", { valueAsNumber: true })}
              />
            </label>
            <label>
              Red cards
              <input
                type="number"
                {...register("performance.common.redCards", { valueAsNumber: true })}
              />
            </label>
            <label>
              Training sessions / week
              <input
                type="number"
                {...register("performance.common.trainingFrequencyPerWeek", {
                  valueAsNumber: true
                })}
              />
            </label>
            <label>
              Availability
              <select {...register("performance.common.availability")}>
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
          </div>
          <h3 className="position-metrics-title">{positionGroup} metrics</h3>
          <div className="form-grid performance-grid">
            {positionGroup === "goalkeeper" ? (
              <>
                <label>
                  Saves
                  <input
                    type="number"
                    {...register("performance.positionSpecific.saves", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  Save %
                  <input
                    type="number"
                    {...register("performance.positionSpecific.savePercentage", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Clean sheets
                  <input
                    type="number"
                    {...register("performance.positionSpecific.cleanSheets", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Crosses claimed
                  <input
                    type="number"
                    {...register("performance.positionSpecific.crossesClaimed", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Distribution accuracy %
                  <input
                    type="number"
                    {...register("performance.positionSpecific.distributionAccuracy", {
                      valueAsNumber: true
                    })}
                  />
                </label>
              </>
            ) : null}
            {positionGroup === "defender" ? (
              <>
                <label>
                  Tackles / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.tacklesPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Interceptions / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.interceptionsPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Clearances / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.clearancesPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Aerial duels won %
                  <input
                    type="number"
                    {...register("performance.positionSpecific.aerialDuelsWonPercentage", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Passing accuracy %
                  <input
                    type="number"
                    {...register("performance.positionSpecific.passingAccuracy", {
                      valueAsNumber: true
                    })}
                  />
                </label>
              </>
            ) : null}
            {positionGroup === "midfielder" ? (
              <>
                <label>
                  Pass completion %
                  <input
                    type="number"
                    {...register("performance.positionSpecific.passCompletionPercentage", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Key passes / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.keyPassesPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Assists
                  <input
                    type="number"
                    {...register("performance.positionSpecific.assists", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  Ball recoveries / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.ballRecoveriesPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Chances created
                  <input
                    type="number"
                    {...register("performance.positionSpecific.chancesCreated", {
                      valueAsNumber: true
                    })}
                  />
                </label>
              </>
            ) : null}
            {positionGroup === "forward" ? (
              <>
                <label>
                  Position goals
                  <input
                    type="number"
                    {...register("performance.positionSpecific.goals", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  Total shots
                  <input
                    type="number"
                    {...register("performance.positionSpecific.shots", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  Shots on target
                  <input
                    type="number"
                    {...register("performance.positionSpecific.shotsOnTarget", {
                      valueAsNumber: true
                    })}
                  />
                </label>
                <label>
                  Position assists
                  <input
                    type="number"
                    {...register("performance.positionSpecific.assists", { valueAsNumber: true })}
                  />
                </label>
                <label>
                  Successful dribbles / match
                  <input
                    type="number"
                    step="0.1"
                    {...register("performance.positionSpecific.successfulDribblesPerMatch", {
                      valueAsNumber: true
                    })}
                  />
                </label>
              </>
            ) : null}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <span>03</span> Scouting profile
          </legend>
          <div className="form-grid">
            <label>
              Preferred formation
              <input {...register("qualitative.preferredFormation")} />
            </label>
            <label className="wide">
              Playing style
              <textarea rows={3} {...register("football.preferredPlayingStyle")} />
            </label>
            <label className="wide">
              Strongest qualities
              <textarea rows={3} {...register("qualitative.strongestQualities")} />
            </label>
            <label className="wide">
              Development goals
              <textarea rows={3} {...register("qualitative.developmentGoals")} />
            </label>
            <label className="wide">
              Coach feedback
              <textarea rows={3} {...register("qualitative.coachFeedback")} />
            </label>
            <label className="wide">
              Match experience
              <textarea rows={3} {...register("qualitative.matchExperience")} />
            </label>
            <label className="wide">
              Career objective
              <textarea rows={3} {...register("football.careerObjective")} />
            </label>
            <label className="wide">
              Personal statement
              <textarea rows={3} {...register("qualitative.personalStatement")} />
            </label>
          </div>
        </fieldset>
      </form>
      {!parsed.success ? <p className="error">Profile draft is incomplete or invalid.</p> : null}
    </section>
  );
}

const calculateCompletion = (profile: PlayerProfile): number => {
  const fields = [
    profile.football.fullName,
    profile.football.country,
    profile.football.city,
    profile.football.currentTeam,
    profile.football.primaryPosition,
    profile.football.preferredPlayingStyle,
    profile.football.careerObjective,
    profile.qualitative.strongestQualities,
    profile.qualitative.developmentGoals,
    profile.qualitative.coachFeedback,
    profile.qualitative.personalStatement
  ];
  const complete = fields.filter((field) => field.trim().length > 0).length;
  return Math.round((complete / fields.length) * 100);
};

const createDefaultPositionMetrics = (positionGroup: PositionGroup): PositionMetrics => {
  switch (positionGroup) {
    case "goalkeeper":
      return {
        positionGroup,
        saves: 0,
        savePercentage: 0,
        cleanSheets: 0,
        crossesClaimed: 0,
        distributionAccuracy: 0
      };
    case "defender":
      return {
        positionGroup,
        tacklesPerMatch: 0,
        interceptionsPerMatch: 0,
        clearancesPerMatch: 0,
        aerialDuelsWonPercentage: 0,
        passingAccuracy: 0
      };
    case "midfielder":
      return {
        positionGroup,
        passCompletionPercentage: 0,
        keyPassesPerMatch: 0,
        assists: 0,
        ballRecoveriesPerMatch: 0,
        chancesCreated: 0
      };
    case "forward":
      return {
        positionGroup,
        goals: 0,
        shots: 0,
        shotsOnTarget: 0,
        assists: 0,
        successfulDribblesPerMatch: 0
      };
  }
};
