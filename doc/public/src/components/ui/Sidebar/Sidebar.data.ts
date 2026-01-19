type Sidebar = {
  title: string;
  url?: string;
  children: Sidebar[];
};

export const sidebars: Sidebar[] = [
  {
    title: "IDAH Documentation",
    url: "/",
    children: [],
  },
  {
    title: "PROJECTS",
    children: [
      { title: "Projcts, and Organisation", url: "/projects/organisation", children: [] },
      { title: "Create a project", url: "/projects/create", children: [] },
      { title: "Rename a Project", url: "/projects/rename", children: [] },
      { title: "Delete a Project", url: "/projects/delete", children: [] },
      {
        title: "Project Members",
        url: "/projects/members",
        children: [
          { title: "Adding new Member", url: "/projects/members/add", children: [] },
          { title: "Edit Member", url: "/projects/members/edit", children: [] },
          { title: "Delete Member", url: "/projects/members/delete", children: [] },
        ],
      },
    ],
  },
  {
    title: "WORKFLOWS",
    children: [
      { title: "What is Workflows ?", url: "/workflows/what-is", children: [] },
      { title: "Create a Workflow", url: "/workflows/create", children: [] },
      { title: "Build a Workflow", url: "/workflows/build", children: [] },
      { title: "Test a Workflow", url: "/workflows/test", children: [] },
    ],
  },
];
