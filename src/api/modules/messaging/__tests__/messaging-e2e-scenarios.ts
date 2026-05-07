export type E2EScenarioGroup = {
  suite: string;
  scenarios: string[];
};

export function registerScenarioTodos(group: E2EScenarioGroup) {
  describe.skip(group.suite, () => {
    group.scenarios.forEach((scenario) => {
      it.todo(scenario);
    });
  });
}
