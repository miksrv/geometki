<?php

namespace App\Libraries;

use CodeIgniter\Debug\ExceptionHandler;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\HTTP\CLIRequest;
use CodeIgniter\HTTP\Exceptions\HTTPException;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Exceptions as ExceptionsConfig;
use Throwable;

/**
 * Exception handler for HTTP requests to the REST API.
 *
 * Every uncaught exception or fatal error becomes a JSON response in the
 * same envelope the ResourceController `fail*` helpers produce:
 *
 *     { "status": 500, "error": 500, "messages": { "error": "..." } }
 *
 * The message is always a generic, localised string. File paths, class names,
 * stack traces and exception messages are never sent to the client in any
 * environment — the details are already written to the log by
 * CodeIgniter\Debug\Exceptions before this handler runs (Config\Exceptions::$log).
 *
 * CLI requests (spark commands) keep the framework's default handler so the
 * developer still sees the full error in the terminal.
 */
class ApiExceptionHandler implements ExceptionHandlerInterface
{
    public function __construct(private readonly ExceptionsConfig $config)
    {
    }

    /**
     * @param CLIRequest|\CodeIgniter\HTTP\IncomingRequest $request
     */
    public function handle(
        Throwable $exception,
        RequestInterface $request,
        ResponseInterface $response,
        int $statusCode,
        int $exitCode,
    ): void {
        if ($request instanceof CLIRequest) {
            (new ExceptionHandler($this->config))->handle($exception, $request, $response, $statusCode, $exitCode);

            return;
        }

        // PHP's own `display_errors` output (fatal errors in development) lands
        // in the framework's output buffer before we get here — drop it so the
        // body contains nothing but our JSON.
        if (ENVIRONMENT !== 'testing') {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
        }

        try {
            $response->setStatusCode($statusCode);
        } catch (HTTPException) {
            $statusCode = 500;
            $response->setStatusCode($statusCode);
        }

        if (! headers_sent()) {
            header(
                sprintf(
                    'HTTP/%s %s %s',
                    $request->getProtocolVersion(),
                    $response->getStatusCode(),
                    $response->getReasonPhrase(),
                ),
                true,
                $statusCode,
            );
        }

        $response
            ->setJSON([
                'status'   => $statusCode,
                'error'    => $statusCode,
                'messages' => ['error' => $this->message($request, $statusCode)],
            ])
            ->send();

        if (ENVIRONMENT !== 'testing') {
            // @codeCoverageIgnoreStart
            exit($exitCode);
            // @codeCoverageIgnoreEnd
        }
    }

    /**
     * Generic, localised message for the given status code.
     *
     * The locale filter may not have run yet (e.g. a fatal error while the
     * router loads the controller), so the `Locale` header is read here directly.
     */
    private function message(RequestInterface $request, int $statusCode): string
    {
        $appConfig = config('App');
        $header    = $request->header('Locale');
        $locale    = $header ? $header->getValue() : $appConfig->defaultLocale;

        if (! in_array($locale, $appConfig->supportedLocales, true)) {
            $locale = $appConfig->defaultLocale;
        }

        $key = $statusCode === 404 ? 'Errors.apiNotFound' : 'Errors.apiInternalError';

        return lang($key, [], $locale);
    }
}
