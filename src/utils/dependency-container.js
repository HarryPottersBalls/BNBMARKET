class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
  }

  register(name, dependency) {
    this.dependencies.set(name, dependency);
    return this;
  }

  resolve(name) {
    const dependency = this.dependencies.get(name);
    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }
    return dependency;
  }

  // Factory method for creating services with injected dependencies
  createService(ServiceClass, ...additionalDeps) {
    const deps = Array.from(this.dependencies.values());
    return new ServiceClass(...deps, ...additionalDeps);
  }
}

module.exports = new DependencyContainer();