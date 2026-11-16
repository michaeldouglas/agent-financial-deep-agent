"""Read-only filesystem configuration for native Deep Agents Skills."""

from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from deepagents.middleware.filesystem import FilesystemMiddleware, FilesystemPermission

from .config import SKILLS_ROOT, SKILLS_SOURCE


def create_filesystem_permissions() -> list[FilesystemPermission]:
    """Allow reads only inside the Skills library and deny every write."""
    return [
        # Filesystem permissions are first-match: allow Skills reads, then deny
        # every other read and all writes.
        FilesystemPermission(
            operations=["read"],
            paths=["/skills/**"],
            mode="allow",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ]


def create_skills_backend() -> CompositeBackend:
    """Route Skills to a virtual, root-confined filesystem backend."""
    return CompositeBackend(
        default=StateBackend(),
        routes={
            SKILLS_SOURCE: FilesystemBackend(
                root_dir=str(SKILLS_ROOT),
                virtual_mode=True,
            ),
        },
    )


def create_filesystem_middleware(
    backend: CompositeBackend,
    permissions: list[FilesystemPermission],
) -> FilesystemMiddleware:
    """Expose only the listing and reading tools required by Skills."""
    return FilesystemMiddleware(
        backend=backend,
        tools=["ls", "read_file"],
        permissions=permissions,
    )
