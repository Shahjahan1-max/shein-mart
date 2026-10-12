// TODO: [BACKEND] Replace with API: GET /api/user/team

export interface TeamMember {
  id: string;
  name: string;
  status: "active" | "inactive";
  earnings: number;
  joinedAt: string;
}

export interface TeamData {
  id: string;
  name: string;
  code: string;
  members: TeamMember[];
  totalMembers: number;
  activeMembers: number;
  teamEarnings: number;
  todayEarnings: number;
  weeklyEarnings: number;
  packageParticipation: number;
}

export const TEAM_DATA: TeamData = {
  id: "team-001",
  name: "My Team",
  code: "TEAM-2401",
  members: [
    { id: "u-001", name: "Member 1", status: "active", earnings: 0, joinedAt: "2024-01-10" },
    { id: "u-002", name: "Member 2", status: "active", earnings: 0, joinedAt: "2024-01-15" },
    { id: "u-003", name: "Member 3", status: "inactive", earnings: 0, joinedAt: "2024-01-20" },
  ],
  totalMembers: 3,
  activeMembers: 2,
  teamEarnings: 0,
  todayEarnings: 0,
  weeklyEarnings: 0,
  packageParticipation: 0,
};
