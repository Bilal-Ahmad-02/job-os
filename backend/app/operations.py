"""Typed operation routing, independent of pipes, JSON, and process ownership.

Callers supply an existing, identity-checked engine and a validated request.
Authorization belongs to the caller (the desktop currently uses its native session guard).
This module never opens a database, starts a worker, or invokes maintenance/import operations.
"""

from sqlalchemy import Engine

from app.schemas.application_drafts import ApplicationDraftRequest
from app.schemas.applications import GetRequest, ListRequest, SaveRequest
from app.schemas.desktop import DesktopRequest, DesktopResult
from app.schemas.documents import DocumentListRequest
from app.schemas.evidence import DraftGetRequest
from app.schemas.listings import (
    ListingCreateRequest,
    ListingGetRequest,
    ListingsListRequest,
    ListingTrackRequest,
    ListingUpdateRequest,
    SearchDeleteRequest,
    SearchListRequest,
    SearchSaveRequest,
)
from app.schemas.profile import ProfileGetRequest, ProfileSaveRequest
from app.schemas.review import ReviewGetRequest, ReviewSaveRequest
from app.schemas.tasks import TaskChangeRequest, TaskCreateRequest, TaskListRequest
from app.services.application_drafts import draft_application
from app.services.applications import get_application, list_applications, save_application
from app.services.documents import list_documents
from app.services.evidence import get_draft
from app.services.listings import (
    create_listing,
    delete_search,
    get_listing,
    list_listings,
    list_searches,
    save_search,
    track_listing,
    update_listing,
)
from app.services.profile import get_profile, save_profile
from app.services.review import get_review, save_review
from app.services.tasks import change_task, create_task, list_tasks


def execute_operation(engine: Engine, request: DesktopRequest) -> DesktopResult:
    """Dispatch only explicitly supported operations; never default to a write."""
    match request:
        case ListRequest():
            return list_applications(engine, request)
        case GetRequest():
            return get_application(engine, request)
        case SaveRequest():
            return save_application(engine, request)
        case DocumentListRequest():
            return list_documents(engine)
        case ProfileGetRequest():
            return get_profile(engine)
        case ProfileSaveRequest():
            return save_profile(engine, request)
        case DraftGetRequest():
            return get_draft(engine)
        case ReviewGetRequest():
            return get_review(engine)
        case ReviewSaveRequest():
            return save_review(engine, request)
        case TaskListRequest():
            return list_tasks(engine)
        case TaskCreateRequest():
            return create_task(engine, request)
        case TaskChangeRequest():
            return change_task(engine, request)
        case ListingsListRequest():
            return list_listings(engine, request)
        case ListingGetRequest():
            return get_listing(engine, request)
        case ListingCreateRequest():
            return create_listing(engine, request)
        case ListingUpdateRequest():
            return update_listing(engine, request)
        case ListingTrackRequest():
            return track_listing(engine, request)
        case SearchListRequest():
            return list_searches(engine)
        case SearchSaveRequest():
            return save_search(engine, request)
        case SearchDeleteRequest():
            return delete_search(engine, request)
        case ApplicationDraftRequest():
            return draft_application(engine, request)
        case _:
            raise ValueError("Unsupported operation")
