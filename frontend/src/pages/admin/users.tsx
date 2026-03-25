import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface User {
  id: string;
  name: string;
  nameZh: string;
  email: string;
  role: "MR" | "DM" | "Admin";
  bu: string;
  region: string;
  status: "active" | "inactive";
  avatar: string | null;
  joinDate: string;
}

const MOCK_USERS: User[] = [
  {
    id: "u-001",
    name: "Alice Wang",
    nameZh: "王爱丽",
    email: "alice.wang@beigene.com",
    role: "MR",
    bu: "Oncology",
    region: "East China",
    status: "active",
    avatar: null,
    joinDate: "2024-01-15",
  },
  {
    id: "u-002",
    name: "Bob Zhang",
    nameZh: "张博",
    email: "bob.zhang@beigene.com",
    role: "DM",
    bu: "Hematology",
    region: "North China",
    status: "active",
    avatar: null,
    joinDate: "2024-02-20",
  },
  {
    id: "u-003",
    name: "Carol Li",
    nameZh: "李卡罗",
    email: "carol.li@beigene.com",
    role: "Admin",
    bu: "Oncology",
    region: "Headquarters",
    status: "active",
    avatar: null,
    joinDate: "2023-11-05",
  },
  {
    id: "u-004",
    name: "David Chen",
    nameZh: "陈大卫",
    email: "david.chen@beigene.com",
    role: "MR",
    bu: "Immunology",
    region: "South China",
    status: "inactive",
    avatar: null,
    joinDate: "2024-03-10",
  },
  {
    id: "u-005",
    name: "Eva Liu",
    nameZh: "刘伊娃",
    email: "eva.liu@beigene.com",
    role: "MR",
    bu: "Oncology",
    region: "East China",
    status: "active",
    avatar: null,
    joinDate: "2024-04-01",
  },
  {
    id: "u-006",
    name: "Frank Zhao",
    nameZh: "赵弗兰克",
    email: "frank.zhao@beigene.com",
    role: "DM",
    bu: "Oncology",
    region: "West China",
    status: "active",
    avatar: null,
    joinDate: "2024-01-28",
  },
  {
    id: "u-007",
    name: "Grace Sun",
    nameZh: "孙格蕾丝",
    email: "grace.sun@beigene.com",
    role: "MR",
    bu: "Hematology",
    region: "Central China",
    status: "active",
    avatar: null,
    joinDate: "2024-05-12",
  },
  {
    id: "u-008",
    name: "Henry Wu",
    nameZh: "吴亨利",
    email: "henry.wu@beigene.com",
    role: "MR",
    bu: "Immunology",
    region: "North China",
    status: "inactive",
    avatar: null,
    joinDate: "2024-02-14",
  },
  {
    id: "u-009",
    name: "Ivy Huang",
    nameZh: "黄艾薇",
    email: "ivy.huang@beigene.com",
    role: "Admin",
    bu: "Hematology",
    region: "Headquarters",
    status: "active",
    avatar: null,
    joinDate: "2023-09-20",
  },
  {
    id: "u-010",
    name: "Jack Yang",
    nameZh: "杨杰克",
    email: "jack.yang@beigene.com",
    role: "MR",
    bu: "Oncology",
    region: "South China",
    status: "active",
    avatar: null,
    joinDate: "2024-06-01",
  },
  {
    id: "u-011",
    name: "Karen Xu",
    nameZh: "许凯伦",
    email: "karen.xu@beigene.com",
    role: "DM",
    bu: "Immunology",
    region: "East China",
    status: "active",
    avatar: null,
    joinDate: "2024-03-25",
  },
  {
    id: "u-012",
    name: "Leo Ma",
    nameZh: "马利奥",
    email: "leo.ma@beigene.com",
    role: "MR",
    bu: "Hematology",
    region: "West China",
    status: "inactive",
    avatar: null,
    joinDate: "2024-07-08",
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

const ROLE_BADGE_CLASSES: Record<User["role"], string> = {
  MR: "bg-blue-100 text-blue-800",
  DM: "bg-purple-100 text-purple-800",
  Admin: "bg-orange-100 text-orange-800",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserManagementPage() {
  const { t } = useTranslation("admin");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState(ALL_VALUE);
  const [filterBU, setFilterBU] = useState(ALL_VALUE);
  const [filterStatus, setFilterStatus] = useState(ALL_VALUE);

  // Pagination
  const [page, setPage] = useState(1);

  // Delete dialog
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter((user) => {
      // Search across name, nameZh, email
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          user.name.toLowerCase().includes(q) ||
          user.nameZh.includes(q) ||
          user.email.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (filterRole !== ALL_VALUE && user.role !== filterRole) return false;
      if (filterBU !== ALL_VALUE && user.bu !== filterBU) return false;
      if (filterStatus !== ALL_VALUE && user.status !== filterStatus)
        return false;

      return true;
    });
  }, [searchQuery, filterRole, filterBU, filterStatus]);

  // Paginated users
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleRoleChange = (value: string) => {
    setFilterRole(value);
    setPage(1);
  };

  const handleBUChange = (value: string) => {
    setFilterBU(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setFilterStatus(value);
    setPage(1);
  };

  const confirmDelete = () => {
    // In a real app this would call a delete mutation
    setDeleteConfirmUser(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {t("users.title", { defaultValue: "User Management" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("users.description", {
              defaultValue: "Manage platform users, roles and permissions",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Upload className="size-4" />
            {t("users.importCsv", { defaultValue: "Import CSV" })}
          </Button>
          <Button>
            <Plus className="size-4" />
            {t("users.addUser", { defaultValue: "Add User" })}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("users.searchPlaceholder", {
                  defaultValue: "Search by name or email...",
                })}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue
                  placeholder={t("users.filterRole", {
                    defaultValue: "Role",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("users.allRoles", { defaultValue: "All Roles" })}
                </SelectItem>
                <SelectItem value="MR">MR</SelectItem>
                <SelectItem value="DM">DM</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterBU} onValueChange={handleBUChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue
                  placeholder={t("users.filterBU", {
                    defaultValue: "Business Unit",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("users.allBUs", { defaultValue: "All BUs" })}
                </SelectItem>
                <SelectItem value="Oncology">Oncology</SelectItem>
                <SelectItem value="Hematology">Hematology</SelectItem>
                <SelectItem value="Immunology">Immunology</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue
                  placeholder={t("users.filterStatus", {
                    defaultValue: "Status",
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("users.allStatuses", { defaultValue: "All Status" })}
                </SelectItem>
                <SelectItem value="active">
                  {t("users.active", { defaultValue: "Active" })}
                </SelectItem>
                <SelectItem value="inactive">
                  {t("users.inactive", { defaultValue: "Inactive" })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">
                  {t("users.columnName", { defaultValue: "Name" })}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("users.columnEmail", { defaultValue: "Email" })}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("users.columnRole", { defaultValue: "Role" })}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("users.columnBU", { defaultValue: "BU" })}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                  {t("users.columnRegion", { defaultValue: "Region" })}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("users.columnStatus", { defaultValue: "Status" })}
                </th>
                <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                  {t("users.columnJoinDate", { defaultValue: "Join Date" })}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("users.columnActions", { defaultValue: "Actions" })}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {t("users.noUsers", { defaultValue: "No users found" })}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.nameZh}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={ROLE_BADGE_CLASSES[user.role]}
                      >
                        {user.role}
                      </Badge>
                    </td>

                    {/* BU */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.bu}
                    </td>

                    {/* Region */}
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {user.region}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 rounded-full ${
                            user.status === "active"
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        />
                        <span className="text-sm capitalize">
                          {user.status === "active"
                            ? t("users.active", { defaultValue: "Active" })
                            : t("users.inactive", {
                                defaultValue: "Inactive",
                              })}
                        </span>
                      </div>
                    </td>

                    {/* Join Date */}
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(user.joinDate)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Pencil className="size-4" />
                            {t("users.edit", { defaultValue: "Edit" })}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmUser(user)}
                          >
                            <Trash2 className="size-4" />
                            {t("users.delete", { defaultValue: "Delete" })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("users.showing", {
                defaultValue: "Showing {{from}}-{{to}} of {{total}} users",
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, filteredUsers.length),
                total: filteredUsers.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("users.previous", { defaultValue: "Previous" })}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("users.next", { defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmUser !== null}
        onOpenChange={() => setDeleteConfirmUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("users.deleteTitle", { defaultValue: "Delete User" })}
            </DialogTitle>
            <DialogDescription>
              {t("users.deleteConfirm", {
                defaultValue:
                  'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
                name: deleteConfirmUser?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmUser(null)}
            >
              {t("users.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("users.confirmDelete", { defaultValue: "Delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
