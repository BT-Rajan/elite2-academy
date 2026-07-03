<?php
declare(strict_types=1);

require_once __DIR__ . '/Response.php';

/**
 * Minimal pattern router. Replaces the old manual if-chain dispatch in
 * api/index.php with declarative route registration:
 *
 *   $router->get('/students/{id}', fn($id) => (new StudentController)->get((int)$id));
 *
 * {id} matches digits only; {any} (e.g. {uid}, {parentUid}) matches any
 * non-slash segment. Not a general-purpose framework -- just enough to get
 * route tables out of nested if-statements and into one readable list, with
 * a single place that turns an unmatched request into a 404.
 */
class Router {
    /** @var array<int, array{0:string,1:string,2:callable}> */
    private array $routes = [];

    public function get(string $pattern, callable $handler): self    { return $this->add('GET', $pattern, $handler); }
    public function post(string $pattern, callable $handler): self   { return $this->add('POST', $pattern, $handler); }
    public function put(string $pattern, callable $handler): self    { return $this->add('PUT', $pattern, $handler); }
    public function patch(string $pattern, callable $handler): self  { return $this->add('PATCH', $pattern, $handler); }
    public function delete(string $pattern, callable $handler): self { return $this->add('DELETE', $pattern, $handler); }

    private function add(string $method, string $pattern, callable $handler): self {
        $this->routes[] = [$method, $pattern, $handler];
        return $this;
    }

    public function dispatch(string $method, string $uri): void {
        foreach ($this->routes as [$m, $pattern, $handler]) {
            if ($m !== $method) continue;
            $regex = $this->compile($pattern);
            if (preg_match($regex, $uri, $matches)) {
                array_shift($matches);
                $handler(...array_values($matches));
                return; // handler always ends in Response::* (never)
            }
        }
        Response::notFound("Route not found: $method $uri");
    }

    private function compile(string $pattern): string {
        $regex = preg_replace('/\{id\}/', '(\d+)', $pattern);
        $regex = preg_replace('/\{[a-zA-Z][a-zA-Z0-9]*\}/', '([^\/]+)', $regex);
        return '#^' . $regex . '$#';
    }
}
