"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserTable } from "./user-table"
import { PendingInvitesTable } from "./pending-invites-table"
import { DeactivatedUsersTable } from "./deactivated-users-table"

export function UserManagement() {
  return (
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="invitations">Pending Invites</TabsTrigger>
        <TabsTrigger value="deactivated">Deactivated</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-4">
        <UserTable />
      </TabsContent>
      <TabsContent value="invitations" className="mt-4">
        <PendingInvitesTable />
      </TabsContent>
      <TabsContent value="deactivated" className="mt-4">
        <DeactivatedUsersTable />
      </TabsContent>
    </Tabs>
  )
}
