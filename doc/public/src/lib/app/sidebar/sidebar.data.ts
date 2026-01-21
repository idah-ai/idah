export type SidebarProps = {
  label: string;
  href?: string;
  children: SidebarProps[];
};

export const sidebars: SidebarProps[] = [
  {
    label: "IDAH Documentation",
    href: "/",
    children: [],
  },
  {
    label: "PROJECTS",
    children: [
      {
        label: "Projcts, and Organisation",
        children: [
          { label: "Create a project", href: "/projects/create", children: [] },
          { label: "Rename a Project", href: "/projects/rename", children: [] },
        { label: "Delete a Project", href: "/projects/delete", children: [] },
        ]
      },
      {
        label: "Project Members",
        children: [
          { label: "Adding new Member", href: "/projects/members/add", children: [] },
          { label: "Edit Member", href: "/projects/members/edit", children: [] },
          { label: "Delete Member", href: "/projects/members/delete", children: [] },
        ],
      },
    ],
  },
  {
    label: "WORKFLOWS",
    children: [
      { label: "What is Workflows ?", href: "/workflows/what-is", children: [] },
      { label: "Create a Workflow", href: "/workflows/create", children: [] },
      { label: "Build a Workflow", href: "/workflows/build", children: [] },
      { label: "Test a Workflow", href: "/workflows/test", children: [] },
    ],
  },
];
