"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "ADMIN" | "ASSET_MANAGER" | "DEPARTMENT_HEAD" | "EMPLOYEE";
type ActiveStatus = "ACTIVE" | "INACTIVE";
type Tab = "departments" | "categories" | "employees";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: ActiveStatus;
  department: { id: string; name: string } | null;
  headedDepartments: { id: string; name: string }[];
};

type Department = {
  id: string;
  name: string;
  status: ActiveStatus;
  headId: string | null;
  parentId: string | null;
  head: { id: string; name: string; email: string; role: Role } | null;
  parent: { id: string; name: string } | null;
  _count: { members: number; children: number };
};

type Category = {
  id: string;
  name: string;
  status: ActiveStatus;
  customFields: unknown;
  _count: { assets: number };
};

type DepartmentDraft = {
  name: string;
  status: ActiveStatus;
  headId: string;
  parentId: string;
};

type CategoryDraft = {
  name: string;
  status: ActiveStatus;
  customFieldsText: string;
};

const roles: Role[] = ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"];
const statuses: ActiveStatus[] = ["ACTIVE", "INACTIVE"];

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  ASSET_MANAGER: "Asset Manager",
  DEPARTMENT_HEAD: "Department Head",
  EMPLOYEE: "Employee",
};

const tabLabels: Record<Tab, string> = {
  departments: "Departments",
  categories: "Categories",
  employees: "Employee Directory",
};

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function stringifyCustomFields(value: unknown) {
  if (!value) return "";
  return JSON.stringify(value, null, 2);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Request failed");
  return body.data as T;
}

function StatusBadge({ status }: { status: ActiveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
      )}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

export function SetupClient({
  initialDepartments,
  initialCategories,
  initialEmployees,
}: {
  initialDepartments: Department[];
  initialCategories: Category[];
  initialEmployees: Employee[];
}) {
  const [tab, setTab] = useState<Tab>("departments");
  const [departments, setDepartments] = useState(initialDepartments);
  const [categories, setCategories] = useState(initialCategories);
  const [employees, setEmployees] = useState(initialEmployees);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newDepartment, setNewDepartment] = useState({ name: "", headId: "", parentId: "" });
  const [newCategory, setNewCategory] = useState({
    name: "",
    customFieldsText: "",
  });

  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, DepartmentDraft>>(() =>
    Object.fromEntries(
      initialDepartments.map((department) => [
        department.id,
        {
          name: department.name,
          status: department.status,
          headId: department.headId ?? "",
          parentId: department.parentId ?? "",
        },
      ])
    )
  );
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>(() =>
    Object.fromEntries(
      initialCategories.map((category) => [
        category.id,
        {
          name: category.name,
          status: category.status,
          customFieldsText: stringifyCustomFields(category.customFields),
        },
      ])
    )
  );

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.status === "ACTIVE"),
    [departments]
  );

  function flashSuccess(text: string) {
    setError(null);
    setMessage(text);
  }

  function flashError(err: unknown) {
    setMessage(null);
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    setBusy("department-create");
    try {
      const department = await api<Department>("/api/departments", {
        method: "POST",
        body: JSON.stringify({
          name: newDepartment.name,
          headId: newDepartment.headId || null,
          parentId: newDepartment.parentId || null,
        }),
      });
      setDepartments((current) => [...current, department].sort((a, b) => a.name.localeCompare(b.name)));
      setDepartmentDrafts((current) => ({
        ...current,
        [department.id]: {
          name: department.name,
          status: department.status,
          headId: department.headId ?? "",
          parentId: department.parentId ?? "",
        },
      }));
      setNewDepartment({ name: "", headId: "", parentId: "" });
      flashSuccess("Department created.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function updateDepartment(id: string) {
    const draft = departmentDrafts[id];
    setBusy(`department-${id}`);
    try {
      const department = await api<Department>(`/api/departments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          status: draft.status,
          headId: draft.headId || null,
          parentId: draft.parentId || null,
        }),
      });
      setDepartments((current) => current.map((item) => (item.id === id ? department : item)));
      flashSuccess("Department updated.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy("category-create");
    try {
      const customFields = newCategory.customFieldsText.trim()
        ? JSON.parse(newCategory.customFieldsText)
        : null;
      const category = await api<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategory.name, customFields }),
      });
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryDrafts((current) => ({
        ...current,
        [category.id]: {
          name: category.name,
          status: category.status,
          customFieldsText: stringifyCustomFields(category.customFields),
        },
      }));
      setNewCategory({ name: "", customFieldsText: "" });
      flashSuccess("Category created.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function updateCategory(id: string) {
    const draft = categoryDrafts[id];
    setBusy(`category-${id}`);
    try {
      const customFields = draft.customFieldsText.trim() ? JSON.parse(draft.customFieldsText) : null;
      const category = await api<Category>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: draft.name, status: draft.status, customFields }),
      });
      setCategories((current) => current.map((item) => (item.id === id ? category : item)));
      flashSuccess("Category updated.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function updateEmployeeRole(id: string, role: Role) {
    setBusy(`employee-role-${id}`);
    try {
      const employee = await api<Employee>(`/api/employees/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setEmployees((current) => current.map((item) => (item.id === id ? employee : item)));
      flashSuccess("Role updated.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function updateEmployeeStatus(id: string, status: ActiveStatus) {
    setBusy(`employee-status-${id}`);
    try {
      const employee = await api<Employee>(`/api/employees/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setEmployees((current) => current.map((item) => (item.id === id ? employee : item)));
      flashSuccess("Status updated.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  async function updateEmployeeDepartment(id: string, departmentId: string) {
    setBusy(`employee-department-${id}`);
    try {
      const employee = await api<Employee>(`/api/employees/${id}/department`, {
        method: "PATCH",
        body: JSON.stringify({ departmentId: departmentId || null }),
      });
      setEmployees((current) => current.map((item) => (item.id === id ? employee : item)));
      flashSuccess("Department updated.");
    } catch (err) {
      flashError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Org Setup</h1>
          <p className="text-sm text-muted-foreground">Departments, asset categories, and employee access.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md border px-3 py-2">
            <div className="font-semibold">{departments.length}</div>
            <div className="text-muted-foreground">Depts</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-semibold">{categories.length}</div>
            <div className="text-muted-foreground">Categories</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-semibold">{employees.length}</div>
            <div className="text-muted-foreground">Employees</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {(Object.keys(tabLabels) as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === item
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tabLabels[item]}
          </button>
        ))}
      </div>

      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === "departments" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create department</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createDepartment} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  placeholder="Department name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment((current) => ({ ...current, name: e.target.value }))}
                  required
                />
                <select
                  className={selectClass}
                  value={newDepartment.headId}
                  onChange={(e) => setNewDepartment((current) => ({ ...current, headId: e.target.value }))}
                >
                  <option value="">No head</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={newDepartment.parentId}
                  onChange={(e) => setNewDepartment((current) => ({ ...current, parentId: e.target.value }))}
                >
                  <option value="">No parent</option>
                  {activeDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={busy === "department-create"}>
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Head</th>
                  <th className="px-3 py-2 font-medium">Parent</th>
                  <th className="px-3 py-2 font-medium">Members</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => {
                  const draft = departmentDrafts[department.id];
                  return (
                    <tr key={department.id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setDepartmentDrafts((current) => ({
                              ...current,
                              [department.id]: { ...draft, name: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={draft.status}
                          onChange={(e) =>
                            setDepartmentDrafts((current) => ({
                              ...current,
                              [department.id]: { ...draft, status: e.target.value as ActiveStatus },
                            }))
                          }
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status === "ACTIVE" ? "Active" : "Inactive"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={draft.headId}
                          onChange={(e) =>
                            setDepartmentDrafts((current) => ({
                              ...current,
                              [department.id]: { ...draft, headId: e.target.value },
                            }))
                          }
                        >
                          <option value="">No head</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={draft.parentId}
                          onChange={(e) =>
                            setDepartmentDrafts((current) => ({
                              ...current,
                              [department.id]: { ...draft, parentId: e.target.value },
                            }))
                          }
                        >
                          <option value="">No parent</option>
                          {activeDepartments
                            .filter((item) => item.id !== department.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{department._count.members}</span>
                          <StatusBadge status={department.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateDepartment(department.id)}
                          disabled={busy === `department-${department.id}`}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create category</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createCategory} className="grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_1fr_auto]">
                <Input
                  placeholder="Category name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory((current) => ({ ...current, name: e.target.value }))}
                  required
                />
                <textarea
                  className="min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder='[{"key":"warrantyMonths","label":"Warranty months","type":"number"}]'
                  value={newCategory.customFieldsText}
                  onChange={(e) => setNewCategory((current) => ({ ...current, customFieldsText: e.target.value }))}
                />
                <Button type="submit" disabled={busy === "category-create"}>
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Custom fields</th>
                  <th className="px-3 py-2 font-medium">Assets</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const draft = categoryDrafts[category.id];
                  return (
                    <tr key={category.id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setCategoryDrafts((current) => ({
                              ...current,
                              [category.id]: { ...draft, name: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className={selectClass}
                          value={draft.status}
                          onChange={(e) =>
                            setCategoryDrafts((current) => ({
                              ...current,
                              [category.id]: { ...draft, status: e.target.value as ActiveStatus },
                            }))
                          }
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status === "ACTIVE" ? "Active" : "Inactive"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={draft.customFieldsText}
                          onChange={(e) =>
                            setCategoryDrafts((current) => ({
                              ...current,
                              [category.id]: { ...draft, customFieldsText: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span>{category._count.assets}</span>
                          <StatusBadge status={category.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateCategory(category.id)}
                          disabled={busy === `category-${category.id}`}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "employees" && (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Heads</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t">
                  <td className="px-3 py-3">
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-muted-foreground">{employee.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={selectClass}
                      value={employee.department?.id ?? ""}
                      disabled={busy === `employee-department-${employee.id}`}
                      onChange={(e) => updateEmployeeDepartment(employee.id, e.target.value)}
                    >
                      <option value="">No department</option>
                      {activeDepartments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={selectClass}
                      value={employee.role}
                      disabled={busy === `employee-role-${employee.id}`}
                      onChange={(e) => updateEmployeeRole(employee.id, e.target.value as Role)}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className={selectClass}
                      value={employee.status}
                      disabled={busy === `employee-status-${employee.id}`}
                      onChange={(e) => updateEmployeeStatus(employee.id, e.target.value as ActiveStatus)}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status === "ACTIVE" ? "Active" : "Inactive"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {employee.headedDepartments.length
                      ? employee.headedDepartments.map((department) => department.name).join(", ")
                      : "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
