"""Bounded candidate data. Manual entries are assertions, not verified qualifications."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Label = Annotated[str, StringConstraints(max_length=300)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Notes = Annotated[str, StringConstraints(max_length=4000)]
Month = Annotated[str, StringConstraints(pattern=r"^(|[0-9]{4}-(0[1-9]|1[0-2]))$")]
MAX_PROFILE_BYTES = 256 * 1024


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Entry(Contract):
    id: Annotated[UUID, Field(strict=False)]


class Period(Entry):
    start_month: Month = ""
    end_month: Month = ""
    current: bool = False

    @model_validator(mode="after")
    def chronological(self) -> "Period":
        if self.current and self.end_month:
            raise ValueError("A current entry cannot have an end month")
        if self.start_month and self.end_month and self.start_month > self.end_month:
            raise ValueError("End month must not precede start month")
        return self


class Experience(Period):
    role: Name
    organization: Name
    location: Label = ""
    description: Notes = ""


class Education(Period):
    institution: Name
    qualification: Name
    field_of_study: Label = ""
    completion: Literal["unspecified", "in_progress", "completed"] = "unspecified"
    details: Notes = ""

    @model_validator(mode="after")
    def consistent_completion(self) -> "Education":
        if self.current and self.completion == "completed":
            raise ValueError("Current education cannot be marked completed")
        return self


class Skill(Entry):
    name: Name
    category: Label = ""
    details: Notes = ""


class Project(Period):
    name: Name
    role: Label = ""
    description: Notes = ""
    technologies: list[Name] = Field(default_factory=list, max_length=30)
    url: Annotated[str, StringConstraints(max_length=1000)] = ""


class Certification(Entry):
    name: Name
    issuer: Name
    issued_month: Month = ""
    expires_month: Month = ""
    credential_reference: Label = ""
    details: Notes = ""

    @model_validator(mode="after")
    def chronological(self) -> "Certification":
        if self.issued_month and self.expires_month and self.issued_month > self.expires_month:
            raise ValueError("Expiry must not precede issue month")
        return self


class Preferences(Contract):
    target_roles: list[Name] = Field(default_factory=list, max_length=20)
    locations: list[Name] = Field(default_factory=list, max_length=20)
    work_modes: list[Literal["onsite", "hybrid", "remote"]] = Field(
        default_factory=list, max_length=3
    )
    employment_types: list[
        Literal["full_time", "part_time", "contract", "temporary", "internship", "traineeship"]
    ] = Field(default_factory=list, max_length=6)
    excluded_employers: list[Name] = Field(default_factory=list, max_length=20)
    excluded_keywords: list[Name] = Field(default_factory=list, max_length=20)
    constraints: Notes = ""

    @model_validator(mode="after")
    def distinct_preferences(self) -> "Preferences":
        for values in (
            self.target_roles,
            self.locations,
            self.work_modes,
            self.employment_types,
            self.excluded_employers,
            self.excluded_keywords,
        ):
            if len({value.casefold() for value in values}) != len(values):
                raise ValueError("Duplicate preference")
        return self


class CandidateData(Contract):
    full_name: Label = ""
    headline: Label = ""
    location: Label = ""
    summary: Notes = ""
    experience: list[Experience] = Field(default_factory=list, max_length=50)
    education: list[Education] = Field(default_factory=list, max_length=30)
    skills: list[Skill] = Field(default_factory=list, max_length=100)
    projects: list[Project] = Field(default_factory=list, max_length=50)
    certifications: list[Certification] = Field(default_factory=list, max_length=50)
    preferences: Preferences = Field(default_factory=Preferences)

    @model_validator(mode="after")
    def bounded_profile(self) -> "CandidateData":
        identities = [
            entry.id
            for entries in (
                self.experience,
                self.education,
                self.skills,
                self.projects,
                self.certifications,
            )
            for entry in entries
        ]
        if len(set(identities)) != len(identities):
            raise ValueError("Profile entry IDs must be unique")
        if len(self.model_dump_json().encode("utf-8")) > MAX_PROFILE_BYTES:
            raise ValueError("Profile exceeds storage limit")
        return self


class ProfileGetRequest(Contract):
    action: Literal["profile_get"]


class ProfileSaveRequest(Contract):
    action: Literal["profile_save"]
    version: int = Field(ge=0)
    data: CandidateData

    @model_validator(mode="after")
    def require_complete_update(self) -> "ProfileSaveRequest":
        if self.version > 0 and self.data.model_fields_set != set(CandidateData.model_fields):
            raise ValueError("Profile updates must include every top-level data field")
        if self.version > 0 and self.data.preferences.model_fields_set != set(
            Preferences.model_fields
        ):
            raise ValueError("Profile updates must include every preference field")
        return self


class CandidateProfile(Contract):
    version: int = Field(ge=0)
    updated_at: Annotated[str, StringConstraints(max_length=40)]
    evidence_status: Literal["user_provided"] = "user_provided"
    data: CandidateData
