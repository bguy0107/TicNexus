import { describe, it, expect } from "vitest"
import { hasPermission, canCreateRole, isHigherRole } from "../permissions"

describe("hasPermission", () => {
  it("grants ADMIN full franchise access", () => {
    expect(hasPermission("ADMIN", "franchise:create")).toBe(true)
    expect(hasPermission("ADMIN", "franchise:delete")).toBe(true)
  })

  it("restricts FRANCHISE_MANAGER from deleting franchises", () => {
    expect(hasPermission("FRANCHISE_MANAGER", "franchise:delete")).toBe(false)
  })

  it("restricts STORE_USER to location:read:own only", () => {
    expect(hasPermission("STORE_USER", "location:read:own")).toBe(true)
    expect(hasPermission("STORE_USER", "location:create")).toBe(false)
  })
})

describe("canCreateRole", () => {
  it("allows ADMIN to create any role", () => {
    expect(canCreateRole("ADMIN", "FRANCHISE_MANAGER")).toBe(true)
    expect(canCreateRole("ADMIN", "ADMIN")).toBe(true)
  })

  it("prevents SUPERVISOR from creating FRANCHISE_MANAGER", () => {
    expect(canCreateRole("SUPERVISOR", "FRANCHISE_MANAGER")).toBe(false)
  })

  it("allows FRANCHISE_MANAGER to create SUPERVISOR and below", () => {
    expect(canCreateRole("FRANCHISE_MANAGER", "SUPERVISOR")).toBe(true)
    expect(canCreateRole("FRANCHISE_MANAGER", "STORE_USER")).toBe(true)
    expect(canCreateRole("FRANCHISE_MANAGER", "ADMIN")).toBe(false)
  })
})

describe("isHigherRole", () => {
  it("correctly ranks roles", () => {
    expect(isHigherRole("ADMIN", "FRANCHISE_MANAGER")).toBe(true)
    expect(isHigherRole("STORE_USER", "TECHNICIAN")).toBe(false)
    expect(isHigherRole("SUPERVISOR", "SUPERVISOR")).toBe(false)
  })
})
