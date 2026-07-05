<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Audit.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../core/comms/CommEventCatalog.php';
require_once __DIR__ . '/../core/comms/TemplateRenderer.php';
require_once __DIR__ . '/../core/comms/ProviderFactory.php';

/**
 * CommunicationController — the Communication Layer: templates (incl. JSON
 * import/export), sending a single message or a recipient list for any
 * event/channel combination the CommEventCatalog allows, campaigns (Email
 * Campaigns / Newsletters / Promotions), OTP (SMS only), send history, and
 * per-dojo channel provider configuration.
 *
 * "Parent engagement" is intentionally absent from send()/campaigns() —
 * it's in-app chat only (the existing threads/messages feature), so there's
 * nothing for this controller to dispatch; see CommEventCatalog's docblock.
 */
class CommunicationController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /communication/event-types — powers the compose form's event/channel picker.
    public function eventTypes(): never {
        AuthMiddleware::require();
        Response::ok(CommEventCatalog::catalog());
    }

    // ── Templates ────────────────────────────────────────────────────────────

    public function listTemplates(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $eventType = $_GET['eventType'] ?? null;
        $channel   = $_GET['channel']   ?? null;
        $sql = "SELECT * FROM communication_templates WHERE dojo_id = ? AND is_active = 1";
        $p   = [Tenant::dojoId($auth)];
        if ($eventType) { $sql .= " AND event_type = ?"; $p[] = $eventType; }
        if ($channel)   { $sql .= " AND channel = ?";    $p[] = $channel; }
        $sql .= " ORDER BY event_type, channel, name";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok(array_map([$this, 'decorateTemplate'], $stmt->fetchAll()));
    }

    public function createTemplate(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $b = $this->body();
        [$row, $err] = $this->validateTemplatePayload($b);
        if ($err) Response::error($err, 422);

        $stmt = $this->db->prepare("
            INSERT INTO communication_templates (dojo_id, event_type, channel, name, subject, body, variables, created_by)
            VALUES (?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['dojoId'], $row['eventType'], $row['channel'], $row['name'],
            $row['subject'], $row['body'], json_encode($row['variables']), $auth['uid'],
        ]);
        $id = (int)$this->db->lastInsertId();
        Response::created($this->getTemplateRow($id, $auth));
    }

    public function updateTemplate(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $this->getTemplateRow($id, $auth); // 404s if not found/wrong dojo
        $b = $this->body();
        [$row, $err] = $this->validateTemplatePayload($b);
        if ($err) Response::error($err, 422);

        $this->db->prepare("
            UPDATE communication_templates SET event_type=?, channel=?, name=?, subject=?, body=?, variables=?
            WHERE id = ? AND dojo_id = ?")
            ->execute([
                $row['eventType'], $row['channel'], $row['name'], $row['subject'],
                $row['body'], json_encode($row['variables']), $id, $auth['dojoId'],
            ]);
        Response::ok($this->getTemplateRow($id, $auth));
    }

    public function deactivateTemplate(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $this->getTemplateRow($id, $auth);
        $this->db->prepare("UPDATE communication_templates SET is_active = 0 WHERE id = ? AND dojo_id = ?")
            ->execute([$id, $auth['dojoId']]);
        Response::ok(['deactivated' => true]);
    }

    // POST /communication/templates/import
    // Body: {"templates": [{eventType, channel, name, subject?, body, variables?}, ...]}
    // Upserts on (dojo, eventType, channel, name). Every row is validated
    // against CommEventCatalog before anything is written -- a single bad
    // row is reported by index without touching the DB for the batch, so a
    // partially-bad upload never partially applies.
    public function importTemplates(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $b = $this->body();
        $templates = $b['templates'] ?? null;
        if (!is_array($templates) || count($templates) === 0) {
            Response::error('Expected a non-empty "templates" array.', 422);
        }

        $errors = [];
        $valid  = [];
        foreach ($templates as $i => $t) {
            [$row, $err] = $this->validateTemplatePayload((array)$t);
            if ($err) { $errors[] = ['index' => $i, 'message' => $err]; continue; }
            $valid[] = $row;
        }
        if ($errors) Response::error('Some templates failed validation — nothing was imported.', 422, ['errors' => $errors]);

        $imported = 0; $updated = 0;
        foreach ($valid as $row) {
            $existing = $this->db->prepare("
                SELECT id FROM communication_templates
                WHERE dojo_id = ? AND event_type = ? AND channel = ? AND name = ?");
            $existing->execute([$auth['dojoId'], $row['eventType'], $row['channel'], $row['name']]);
            $existingId = $existing->fetch();
            if ($existingId) {
                $this->db->prepare("
                    UPDATE communication_templates SET subject=?, body=?, variables=?, is_active=1
                    WHERE id = ?")
                    ->execute([$row['subject'], $row['body'], json_encode($row['variables']), $existingId['id']]);
                $updated++;
            } else {
                $this->db->prepare("
                    INSERT INTO communication_templates (dojo_id, event_type, channel, name, subject, body, variables, created_by)
                    VALUES (?,?,?,?,?,?,?,?)")
                    ->execute([
                        $auth['dojoId'], $row['eventType'], $row['channel'], $row['name'],
                        $row['subject'], $row['body'], json_encode($row['variables']), $auth['uid'],
                    ]);
                $imported++;
            }
        }
        Audit::log($this->db, $auth, 'communication.templates_import', 'communication_template', 'bulk',
            ['imported' => $imported, 'updated' => $updated]);
        Response::ok(['imported' => $imported, 'updated' => $updated, 'total' => count($valid)]);
    }

    // GET /communication/templates/export — same JSON shape importTemplates() accepts.
    public function exportTemplates(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $stmt = $this->db->prepare("
            SELECT event_type, channel, name, subject, body, variables
            FROM communication_templates WHERE dojo_id = ? AND is_active = 1
            ORDER BY event_type, channel, name");
        $stmt->execute([$auth['dojoId']]);
        $templates = array_map(function ($r) {
            return [
                'eventType' => $r['event_type'], 'channel' => $r['channel'], 'name' => $r['name'],
                'subject'   => $r['subject'], 'body' => $r['body'],
                'variables' => $r['variables'] ? json_decode($r['variables'], true) : [],
            ];
        }, $stmt->fetchAll());
        Response::ok(['templates' => $templates]);
    }

    private function validateTemplatePayload(array $b): array {
        $eventType = $b['eventType'] ?? null;
        $channel   = $b['channel']   ?? null;
        $name      = trim((string)($b['name'] ?? ''));
        $body      = (string)($b['body'] ?? '');
        $subject   = isset($b['subject']) ? trim((string)$b['subject']) : null;

        if (!$eventType || !CommEventCatalog::isValidEvent($eventType)) return [null, "Unknown eventType \"$eventType\"."];
        if (!$channel) return [null, 'channel is required.'];
        if (!CommEventCatalog::isChannelAllowed($eventType, $channel)) {
            $allowed = implode(', ', CommEventCatalog::channelsFor($eventType));
            return [null, "Channel \"$channel\" isn't allowed for \"$eventType\" — allowed: $allowed."];
        }
        if ($name === '') return [null, 'name is required.'];
        if ($body === '') return [null, 'body is required.'];
        if ($channel === 'email' && !$subject) return [null, 'subject is required for email templates.'];

        $variables = $b['variables'] ?? array_unique(array_merge(
            TemplateRenderer::extractPlaceholders($body),
            $subject ? TemplateRenderer::extractPlaceholders($subject) : []
        ));
        return [[
            'eventType' => $eventType, 'channel' => $channel, 'name' => $name,
            'subject' => $subject, 'body' => $body, 'variables' => array_values($variables),
        ], null];
    }

    private function getTemplateRow(int $id, array $auth): array {
        $stmt = $this->db->prepare("SELECT * FROM communication_templates WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$id, $auth['dojoId']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Template not found.');
        return $this->decorateTemplate($row);
    }

    private function decorateTemplate(array $row): array {
        $row['variables'] = $row['variables'] ? json_decode($row['variables'], true) : [];
        return $row;
    }

    // ── Send ─────────────────────────────────────────────────────────────────

    // POST /communication/send — a single message for one recipient.
    public function send(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $b = $this->body();
        $result = $this->dispatchOne($auth, $b);
        Response::ok($result);
    }

    // POST /communication/send/bulk — same event/channel/template, many
    // recipients (e.g. an Announcement to a hand-picked list). For a whole
    // audience (not a hand-picked list) use campaigns instead.
    public function sendBulk(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $b = $this->body();
        $recipients = $b['recipients'] ?? [];
        if (!is_array($recipients) || count($recipients) === 0) {
            Response::error('Expected a non-empty "recipients" array.', 422);
        }
        $results = [];
        foreach ($recipients as $r) {
            $merged = array_merge($b, (array)$r);
            unset($merged['recipients']);
            $results[] = $this->dispatchOne($auth, $merged, throwOnError: false);
        }
        $sent = count(array_filter($results, fn($r) => $r['status'] === 'sent'));
        Response::ok(['total' => count($results), 'sent' => $sent, 'failed' => count($results) - $sent, 'results' => $results]);
    }

    /**
     * Core single-recipient send path shared by send(), sendBulk(), and
     * campaign sending. Resolves the recipient's address/name/template data,
     * renders (or takes ad-hoc) subject/body, enforces the branch write-guard
     * for coaches, dispatches through the configured provider, and logs the
     * outcome either way (failed sends still leave an audit row with the error).
     */
    private function dispatchOne(array $auth, array $b, bool $throwOnError = true): array {
        $eventType = $b['eventType'] ?? null;
        $channel   = $b['channel']   ?? null;
        if (!$eventType || !CommEventCatalog::isValidEvent($eventType)) {
            return $this->fail($throwOnError, "Unknown eventType \"$eventType\".");
        }
        if ($eventType === 'parent_engagement') {
            return $this->fail($throwOnError, 'Parent engagement is in-app chat only — use POST /threads/:id/messages instead.');
        }
        if (!$channel || !CommEventCatalog::isChannelAllowed($eventType, $channel)) {
            $allowed = implode(', ', CommEventCatalog::channelsFor($eventType));
            return $this->fail($throwOnError, "Channel \"$channel\" isn't allowed for \"$eventType\" — allowed: $allowed.");
        }

        // Resolve recipient + template data.
        [$address, $name, $recipientType, $recipientRef, $data, $branchId, $err] = $this->resolveRecipient($auth, $channel, $b);
        if ($err) return $this->fail($throwOnError, $err);
        if ($branchId !== null) Tenant::assertBranchWriteAccess($auth, $branchId);

        $data = array_merge(['dojoName' => $this->dojoName($auth['dojoId'])], $data, (array)($b['variables'] ?? []));

        $templateId = !empty($b['templateId']) ? (int)$b['templateId'] : null;
        $subject = $b['subject'] ?? null;
        $body    = $b['body']    ?? null;
        if ($templateId) {
            $tpl = $this->db->prepare("SELECT * FROM communication_templates WHERE id = ? AND dojo_id = ? AND is_active = 1");
            $tpl->execute([$templateId, $auth['dojoId']]);
            $row = $tpl->fetch();
            if (!$row) return $this->fail($throwOnError, 'Template not found.');
            if ($row['event_type'] !== $eventType || $row['channel'] !== $channel) {
                return $this->fail($throwOnError, 'Template does not match the requested eventType/channel.');
            }
            $subject = $row['subject'];
            $body    = $row['body'];
        }
        if (!$body) return $this->fail($throwOnError, 'No template selected and no ad-hoc body provided.');
        if ($channel === 'email' && !$subject) return $this->fail($throwOnError, 'Email requires a subject (from the template or ad-hoc).');

        $renderedSubject = $subject ? TemplateRenderer::render($subject, $data) : null;
        $renderedBody    = TemplateRenderer::render($body, $data);

        ['provider' => $providerName, 'config' => $config, 'driver' => $driver] = ProviderFactory::resolve($this->db, $auth['dojoId'], $channel);
        $sendResult = $driver->send($address, (string)$renderedSubject, $renderedBody, $config);

        $status = $sendResult['success'] ? 'sent' : 'failed';
        $stmt = $this->db->prepare("
            INSERT INTO communication_logs
                (dojo_id, branch_id, event_type, channel, template_id, campaign_id, recipient_type,
                 recipient_ref, recipient_name, recipient_address, subject, body, status,
                 provider, provider_message_id, error, sent_by, sent_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $auth['dojoId'], $branchId, $eventType, $channel, $templateId, $b['campaignId'] ?? null,
            $recipientType, $recipientRef, $name, $address, $renderedSubject, $renderedBody, $status,
            $providerName, $sendResult['providerMessageId'], $sendResult['error'], $auth['uid'],
            $sendResult['success'] ? date('Y-m-d H:i:s') : null,
        ]);
        $logId = (int)$this->db->lastInsertId();

        if (!$sendResult['success'] && $throwOnError) {
            Response::error("Send failed: {$sendResult['error']}", 502, ['logId' => $logId]);
        }
        return [
            'logId' => $logId, 'status' => $status, 'recipientAddress' => $address,
            'recipientName' => $name, 'error' => $sendResult['error'],
        ];
    }

    private function fail(bool $throwOnError, string $message): array {
        if ($throwOnError) Response::error($message, 422);
        return ['logId' => null, 'status' => 'failed', 'recipientAddress' => null, 'recipientName' => null, 'error' => $message];
    }

    /**
     * @return array{0:?string,1:?string,2:string,3:?string,4:array,5:?int,6:?string}
     *  [address, name, recipientType, recipientRef, templateData, branchId, error]
     */
    private function resolveRecipient(array $auth, string $channel, array $b): array {
        $recipientType = $b['recipientType'] ?? (isset($b['studentId']) ? 'student' : (isset($b['parentUid']) ? 'parent' : (isset($b['uid']) ? 'user' : 'custom')));

        if ($recipientType === 'student') {
            $student = Tenant::student($this->db, $auth, (int)($b['studentId'] ?? 0));
            $parent = $this->db->prepare("SELECT display_name, phone, email FROM users WHERE uid = ?");
            $parent->execute([$student['parent_uid']]);
            $p = $parent->fetch();
            if (!$p) return [null, null, $recipientType, null, [], null, 'Student has no parent account on file.'];
            $address = $channel === 'email' ? $p['email'] : $p['phone'];
            if (!$address) return [null, null, $recipientType, null, [], null, "Parent has no {$channel} address on file."];
            $data = [
                'studentName' => trim($student['first_name'] . ' ' . $student['last_name']),
                'parentName'  => $p['display_name'],
            ];
            return [$address, $p['display_name'], $recipientType, (string)$student['id'], $data, (int)$student['branch_id'], null];
        }

        if ($recipientType === 'parent' || $recipientType === 'user') {
            $uid = $b['parentUid'] ?? $b['uid'] ?? null;
            if (!$uid) return [null, null, $recipientType, null, [], null, 'parentUid or uid is required.'];
            $u = $this->db->prepare("SELECT uid, display_name, phone, email, branch_id, dojo_id FROM users WHERE uid = ? AND dojo_id = ?");
            $u->execute([$uid, $auth['dojoId']]);
            $row = $u->fetch();
            if (!$row) return [null, null, $recipientType, null, [], null, 'User not found in this dojo.'];
            $address = $channel === 'email' ? $row['email'] : $row['phone'];
            if (!$address) return [null, null, $recipientType, null, [], null, "User has no {$channel} address on file."];
            $branchId = $row['branch_id'] !== null ? (int)$row['branch_id'] : null;
            return [$address, $row['display_name'], $recipientType, $row['uid'], ['parentName' => $row['display_name']], $branchId, null];
        }

        // Custom: an ad-hoc phone/email the composer typed directly (e.g. a
        // prospective admission enquiry with no account yet).
        $address = $b['address'] ?? null;
        $name    = $b['name']    ?? $address;
        if (!$address) return [null, null, 'custom', null, [], null, 'address is required for a custom recipient.'];
        return [$address, $name, 'custom', null, ['parentName' => $name], null, null];
    }

    private function dojoName(string $dojoId): string {
        $stmt = $this->db->prepare("SELECT name FROM dojos WHERE id = ?");
        $stmt->execute([$dojoId]);
        return $stmt->fetch()['name'] ?? 'the dojo';
    }

    // ── History ──────────────────────────────────────────────────────────────

    public function listLogs(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $sql = "SELECT * FROM communication_logs WHERE dojo_id = ?";
        $p   = [Tenant::dojoId($auth)];
        if ($auth['role'] === 'coach' && !Tenant::isBranchUnrestricted($auth)) {
            $sql .= " AND sent_by = ?"; $p[] = $auth['uid'];
        }
        foreach (['eventType' => 'event_type', 'channel' => 'channel', 'status' => 'status'] as $param => $col) {
            if (!empty($_GET[$param])) { $sql .= " AND $col = ?"; $p[] = $_GET[$param]; }
        }
        if (!empty($_GET['studentId'])) { $sql .= " AND recipient_type = 'student' AND recipient_ref = ?"; $p[] = $_GET['studentId']; }
        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $sql .= " ORDER BY created_at DESC LIMIT $limit";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }

    public function getLog(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $stmt = $this->db->prepare("SELECT * FROM communication_logs WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$id, $auth['dojoId']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Log entry not found.');
        if ($auth['role'] === 'coach' && !Tenant::isBranchUnrestricted($auth) && $row['sent_by'] !== $auth['uid']) {
            Response::forbidden('You can only view messages you sent.');
        }
        Response::ok($row);
    }

    // ── Campaigns (Email Campaigns / Newsletters / Promotions) ──────────────

    public function listCampaigns(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        $sql = "SELECT * FROM communication_campaigns WHERE dojo_id = ?";
        $p   = [Tenant::dojoId($auth)];
        if (!empty($_GET['type']))   { $sql .= " AND type = ?";   $p[] = $_GET['type']; }
        if (!empty($_GET['status'])) { $sql .= " AND status = ?"; $p[] = $_GET['status']; }
        $sql .= " ORDER BY created_at DESC";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok(array_map(fn($r) => $this->decorateCampaign($r), $stmt->fetchAll()));
    }

    public function getCampaign(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        $campaign = $this->getCampaignRow($id, $auth);
        $recipients = $this->db->prepare("SELECT * FROM communication_campaign_recipients WHERE campaign_id = ? ORDER BY id");
        $recipients->execute([$id]);
        $campaign['recipients'] = $recipients->fetchAll();
        Response::ok($campaign);
    }

    // POST /communication/campaigns
    // Body: {type, channel, templateId, name, audienceFilter:{role?, branchId?, disciplineId?}, branchId?}
    // Materializes the recipient list immediately (a snapshot of the
    // audience right now) so the campaign's total is visible before sending;
    // POST /communication/campaigns/:id/send works through that snapshot.
    public function createCampaign(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $b = $this->body();
        Validator::make($b)
            ->required('type')->in('type', CommEventCatalog::CAMPAIGN_TYPES)
            ->required('channel')->in('channel', ['email', 'whatsapp'])
            ->required('templateId')->int('templateId', 1)
            ->required('name')->string('name', 1, 150)
            ->check();

        if (!CommEventCatalog::isChannelAllowed($b['type'], $b['channel'])) {
            $allowed = implode(', ', CommEventCatalog::channelsFor($b['type']));
            Response::error("Channel \"{$b['channel']}\" isn't allowed for \"{$b['type']}\" — allowed: $allowed.", 422);
        }
        $tpl = $this->db->prepare("SELECT * FROM communication_templates WHERE id = ? AND dojo_id = ? AND is_active = 1");
        $tpl->execute([$b['templateId'], $auth['dojoId']]);
        $template = $tpl->fetch();
        if (!$template) Response::notFound('Template not found.');
        if ($template['event_type'] !== $b['type'] || $template['channel'] !== $b['channel']) {
            Response::error('Template does not match the requested type/channel.', 422);
        }

        $branchId = !empty($b['branchId']) ? (int)$b['branchId'] : null;
        if ($branchId) Tenant::branch($this->db, $auth, $branchId);

        $audience = $this->resolveAudience($auth, $branchId, (array)($b['audienceFilter'] ?? []), $b['channel']);

        $this->db->prepare("
            INSERT INTO communication_campaigns (dojo_id, branch_id, type, channel, template_id, name, audience_filter, total_recipients, created_by)
            VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([
                $auth['dojoId'], $branchId, $b['type'], $b['channel'], $b['templateId'], $b['name'],
                json_encode($b['audienceFilter'] ?? []), count($audience), $auth['uid'],
            ]);
        $campaignId = (int)$this->db->lastInsertId();

        $ins = $this->db->prepare("
            INSERT INTO communication_campaign_recipients (campaign_id, parent_uid, recipient_name, recipient_address)
            VALUES (?,?,?,?)");
        foreach ($audience as $a) $ins->execute([$campaignId, $a['uid'], $a['name'], $a['address']]);

        Response::created($this->getCampaignRow($campaignId, $auth));
    }

    // POST /communication/campaigns/:id/send — processes every pending
    // recipient inline. Fine for the audience sizes a single dojo has; a
    // busier deployment would move this to a queue worker, but the log/campaign
    // tables here are already shaped so that swap wouldn't change the schema.
    public function sendCampaign(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $campaign = $this->getCampaignRow($id, $auth);
        if ($campaign['status'] === 'sent') Response::error('This campaign has already been sent.', 422);

        $this->db->prepare("UPDATE communication_campaigns SET status = 'sending' WHERE id = ?")->execute([$id]);

        $recipients = $this->db->prepare("SELECT * FROM communication_campaign_recipients WHERE campaign_id = ? AND status = 'pending'");
        $recipients->execute([$id]);
        $sent = 0; $failed = 0;
        foreach ($recipients->fetchAll() as $r) {
            $result = $this->dispatchOne($auth, [
                'eventType'     => $campaign['type'],
                'channel'       => $campaign['channel'],
                'templateId'    => $campaign['template_id'],
                'recipientType' => 'custom',
                'address'       => $r['recipient_address'],
                'name'          => $r['recipient_name'],
                'campaignId'    => $id,
            ], throwOnError: false);
            $ok = $result['status'] === 'sent';
            $ok ? $sent++ : $failed++;
            $this->db->prepare("UPDATE communication_campaign_recipients SET status=?, error=?, sent_at=? WHERE id=?")
                ->execute([$ok ? 'sent' : 'failed', $result['error'], $ok ? date('Y-m-d H:i:s') : null, $r['id']]);
        }

        $this->db->prepare("
            UPDATE communication_campaigns
            SET status = ?, sent_count = sent_count + ?, failed_count = failed_count + ?, sent_at = NOW()
            WHERE id = ?")
            ->execute([$failed > 0 && $sent === 0 ? 'failed' : 'sent', $sent, $failed, $id]);

        Audit::log($this->db, $auth, 'communication.campaign_send', 'communication_campaign', (string)$id, ['sent' => $sent, 'failed' => $failed]);
        Response::ok($this->getCampaignRow($id, $auth));
    }

    public function deleteCampaign(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach') AuthMiddleware::requireHeadCoach($auth);
        $campaign = $this->getCampaignRow($id, $auth);
        if ($campaign['status'] !== 'draft') Response::error('Only a draft campaign can be deleted — a sent campaign is kept for history.', 422);
        $this->db->prepare("DELETE FROM communication_campaigns WHERE id = ? AND dojo_id = ?")->execute([$id, $auth['dojoId']]);
        Response::ok(['deleted' => true]);
    }

    private function getCampaignRow(int $id, array $auth): array {
        $stmt = $this->db->prepare("SELECT * FROM communication_campaigns WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$id, $auth['dojoId']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Campaign not found.');
        return $this->decorateCampaign($row);
    }

    private function decorateCampaign(array $row): array {
        $row['audience_filter'] = $row['audience_filter'] ? json_decode($row['audience_filter'], true) : [];
        return $row;
    }

    // Resolves an audience_filter into a concrete recipient list at
    // campaign-creation time. Supported filter keys: role ('parent'|'coach'
    // |'staff', default 'parent' since campaigns/newsletters/promotions are
    // fundamentally parent-facing), disciplineId (only parents with a
    // student in that discipline). branchId (from the top-level campaign,
    // not the filter) narrows to one branch when given, dojo-wide otherwise.
    private function resolveAudience(array $auth, ?int $branchId, array $filter, string $channel): array {
        $role = $filter['role'] ?? 'parent';
        $col  = $channel === 'email' ? 'u.email' : 'u.phone';

        if ($role === 'parent') {
            $sql = "SELECT DISTINCT u.uid, u.display_name AS name, $col AS address
                    FROM users u JOIN students s ON s.parent_uid = u.uid
                    WHERE u.dojo_id = ? AND u.role = 'parent' AND u.is_active = 1 AND s.is_active = 1 AND $col IS NOT NULL AND $col != ''";
            $p = [$auth['dojoId']];
            if ($branchId) { $sql .= " AND s.branch_id = ?"; $p[] = $branchId; }
            if (!empty($filter['disciplineId'])) { $sql .= " AND s.discipline_id = ?"; $p[] = (int)$filter['disciplineId']; }
        } else {
            $sql = "SELECT uid, display_name AS name, $col AS address FROM users u
                    WHERE dojo_id = ? AND role = ? AND is_active = 1 AND $col IS NOT NULL AND $col != ''";
            $p = [$auth['dojoId'], $role];
            if ($branchId) { $sql .= " AND branch_id = ?"; $p[] = $branchId; }
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        return $stmt->fetchAll();
    }

    // ── OTP (SMS only) ───────────────────────────────────────────────────────

    // POST /communication/otp/send — body: {phone, purpose?}
    public function sendOtp(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff');
        $b = $this->body();
        Validator::make($b)->required('phone')->string('phone', 5, 30)->check();
        $phone   = $b['phone'];
        $purpose = $b['purpose'] ?? 'verify_phone';

        $recent = $this->db->prepare("
            SELECT id FROM otp_codes WHERE dojo_id = ? AND phone = ? AND purpose = ?
              AND consumed_at IS NULL AND created_at > (NOW() - INTERVAL 60 SECOND)");
        $recent->execute([$auth['dojoId'], $phone, $purpose]);
        if ($recent->fetch()) Response::error('An OTP was just sent to this number — wait a minute before resending.', 429);

        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->db->prepare("
            INSERT INTO otp_codes (dojo_id, phone, purpose, code_hash, expires_at)
            VALUES (?,?,?,?, NOW() + INTERVAL 10 MINUTE)")
            ->execute([$auth['dojoId'], $phone, $purpose, password_hash($code, PASSWORD_BCRYPT)]);

        $tpl = $this->db->prepare("SELECT body FROM communication_templates WHERE dojo_id = ? AND event_type = 'otp' AND channel = 'sms' AND is_active = 1 LIMIT 1");
        $tpl->execute([$auth['dojoId']]);
        $tplRow = $tpl->fetch();
        $message = TemplateRenderer::render(
            $tplRow['body'] ?? 'Your {{dojoName}} verification code is {{code}}. It expires in 10 minutes.',
            ['dojoName' => $this->dojoName($auth['dojoId']), 'code' => $code]
        );

        ['provider' => $providerName, 'config' => $config, 'driver' => $driver] = ProviderFactory::resolve($this->db, $auth['dojoId'], 'sms');
        $result = $driver->send($phone, '', $message, $config);

        $this->db->prepare("
            INSERT INTO communication_logs (dojo_id, event_type, channel, recipient_type, recipient_address, body, status, provider, provider_message_id, error, sent_by, sent_at)
            VALUES (?, 'otp', 'sms', 'custom', ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([
                $auth['dojoId'], $phone, $message, $result['success'] ? 'sent' : 'failed',
                $providerName, $result['providerMessageId'], $result['error'], $auth['uid'],
                $result['success'] ? date('Y-m-d H:i:s') : null,
            ]);

        if (!$result['success']) Response::error("Could not send OTP: {$result['error']}", 502);
        Response::ok(['sent' => true, 'expiresInSeconds' => 600]);
    }

    // POST /communication/otp/verify — body: {phone, code, purpose?}
    public function verifyOtp(): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        Validator::make($b)->required('phone')->required('code')->check();
        $purpose = $b['purpose'] ?? 'verify_phone';

        $stmt = $this->db->prepare("
            SELECT * FROM otp_codes WHERE dojo_id = ? AND phone = ? AND purpose = ? AND consumed_at IS NULL
            ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$auth['dojoId'], $b['phone'], $purpose]);
        $row = $stmt->fetch();
        if (!$row) Response::error('No pending OTP for this number — request a new one.', 422);
        if (strtotime($row['expires_at']) < time()) Response::error('This OTP has expired — request a new one.', 422);
        if ($row['attempts'] >= 5) Response::error('Too many incorrect attempts — request a new OTP.', 429);

        if (!password_verify((string)$b['code'], $row['code_hash'])) {
            $this->db->prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")->execute([$row['id']]);
            Response::error('Incorrect code.', 422);
        }
        $this->db->prepare("UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?")->execute([$row['id']]);
        Response::ok(['verified' => true]);
    }

    // ── Provider configuration (Admin only) ─────────────────────────────────

    public function listProviders(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $stmt = $this->db->prepare("SELECT * FROM communication_provider_configs WHERE dojo_id = ?");
        $stmt->execute([$auth['dojoId']]);
        $configured = [];
        foreach ($stmt->fetchAll() as $row) $configured[$row['channel']] = $row;

        $out = [];
        foreach (['whatsapp', 'sms', 'email'] as $channel) {
            $row = $configured[$channel] ?? null;
            $out[] = [
                'channel'   => $channel,
                'provider'  => $row['provider'] ?? ($channel === 'email' ? 'smtp' : 'log'),
                'config'    => ProviderFactory::maskConfig($row && $row['config'] ? json_decode($row['config'], true) : []),
                'isActive'  => $row ? (bool)$row['is_active'] : true,
                'available' => ProviderFactory::availableProviders($channel),
            ];
        }
        Response::ok($out);
    }

    public function updateProvider(string $channel): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        if (!in_array($channel, ['whatsapp', 'sms', 'email'], true)) Response::error('Unknown channel.', 422);
        $b = $this->body();
        $provider = $b['provider'] ?? null;
        if (!$provider || !in_array($provider, ProviderFactory::availableProviders($channel), true)) {
            Response::error('Unknown provider for this channel.', 422);
        }
        $newConfig = (array)($b['config'] ?? []);

        // Preserve any secret the client sent back masked (e.g. the user only
        // changed the "from number" and left the auth token showing dots) —
        // merge onto the existing stored config rather than overwriting.
        $existing = $this->db->prepare("SELECT config FROM communication_provider_configs WHERE dojo_id = ? AND channel = ?");
        $existing->execute([$auth['dojoId'], $channel]);
        $existingConfig = ($row = $existing->fetch()) && $row['config'] ? json_decode($row['config'], true) : [];
        foreach (ProviderFactory::SECRET_KEYS as $key) {
            if (isset($newConfig[$key]) && str_contains((string)$newConfig[$key], '•')) {
                $newConfig[$key] = $existingConfig[$key] ?? $newConfig[$key];
            }
        }

        $this->db->prepare("
            INSERT INTO communication_provider_configs (dojo_id, channel, provider, config)
            VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE provider = VALUES(provider), config = VALUES(config)")
            ->execute([$auth['dojoId'], $channel, $provider, json_encode($newConfig)]);

        Audit::log($this->db, $auth, 'communication.provider_update', 'communication_provider', $channel, ['provider' => $provider]);
        Response::ok(['updated' => true]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
