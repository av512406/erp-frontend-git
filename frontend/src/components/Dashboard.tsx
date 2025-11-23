import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, BookOpen, TrendingUp } from "lucide-react";

interface DashboardStats {
  totalStudents: number;
  pendingFees: number;
  gradesEntered: number;
  avgAttendance: number;
}

interface DashboardProps {
  stats: DashboardStats;
  userRole: 'admin' | 'teacher';
}

export default function Dashboard({ stats, userRole }: DashboardProps) {
  const adminCards = [
    {
      title: "Total Students",
      value: stats.totalStudents,
      icon: Users,
      description: "Active enrollments"
    },
    {
      title: "Pending Fees",
      value: `₹${stats.pendingFees.toLocaleString('en-IN')}`,
      icon: DollarSign,
      description: "Outstanding payments"
    },
    {
      title: "Classes Entered",
      value: stats.gradesEntered,
      icon: BookOpen,
      description: "This term"
    },
    {
      title: "Avg Attendance",
      value: `${stats.avgAttendance}%`,
      icon: TrendingUp,
      description: "Last 30 days"
    }
  ];

  const teacherCards = [
    {
      title: "My Classes",
      value: "6",
      icon: BookOpen,
      description: "Active classes"
    },
    {
      title: "Students",
      value: stats.totalStudents,
      icon: Users,
      description: "Total students"
    },
    {
      title: "Classes Pending",
      value: "12",
      icon: TrendingUp,
      description: "To be entered"
    }
  ];

  const cards = userRole === 'admin' ? adminCards : teacherCards.slice(0, 3);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's an overview of your school.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
