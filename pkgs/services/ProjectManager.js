const pkg = {
  name: "Project Manager",
  svcName: "ProjectSvc",
  type: "svc",
  privs: 0,
  start: async function (Root) {
    console.log("[PROJECT MANAGEMENT] Project Manager Service initialized.");
  },
  data: {
    getProjectList: async () => {},
    readProject: (data) => {},
    saveProject: (data) => {},
  },
  end: async function () {
    console.log("[PROJECT MANAGEMENT] Project Manager Service stopped.");
  },
};

export default pkg;
