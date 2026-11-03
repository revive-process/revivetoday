import { guardFormRequest } from "../../lib/server/form-guard.js";
import {
    getRuntimeEnv,
} from "../../lib/server/runtime-env.js";


import {
    sendMicrosoftMail,
} from "../../lib/server/microsoft-mail.js";


export const prerender =
    false;


/* ==========================================================================
   HELPERS
   ========================================================================== */

function clean(value) {
    return String(
        value ?? ""
    ).trim();
}


function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );
}


function escapeHtml(value) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function jsonResponse(
    data,
    status = 200
) {
    return new Response(
        JSON.stringify(
            data
        ),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json",

                "Cache-Control":
                    "no-store",
            },
        }
    );
}


/* ==========================================================================
   CONTACT EMAIL TEMPLATE
   ========================================================================== */

function createContactEmail({
    name,
    email,
    company,
    role,
    phone,
    source,
    page,
    pageUrl,
    submittedAt,
}) {
    const safeUrl =
        pageUrl &&
        /^https?:\/\//i.test(
            pageUrl
        )
            ? escapeHtml(
                pageUrl
            )
            : "";


    return `
<!doctype html>

<html>

<body
    style="
        margin:0;
        padding:0;
        background:#F5F6F8;
        font-family:Arial,Helvetica,sans-serif;
        color:#303A48;
    "
>

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"

    style="
        background:#F5F6F8;
        padding:30px 15px;
    "
>

<tr>

<td align="center">

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"

    style="
        width:100%;
        max-width:680px;
        background:#FFFFFF;
        border:1px solid #E3E7ED;
        border-radius:14px;
        overflow:hidden;
    "
>


<tr>

<td
    style="
        padding:24px 28px;
        background:#24344D;
    "
>

<div
    style="
        color:#FFFFFF;
        font-size:24px;
        font-weight:700;
    "
>
    RE-ViVE
</div>


<div
    style="
        margin-top:5px;
        color:#D8DFEA;
        font-size:14px;
    "
>
    New Website Contact
</div>

</td>

</tr>


<tr>

<td
    style="
        padding:28px;
    "
>

<p
    style="
        margin:0 0 22px;
        font-size:16px;
        line-height:1.6;
    "
>

    A visitor submitted the
    <strong>Contact RE-ViVE</strong>
    form.

</p>


<table
    width="100%"
    cellpadding="10"
    cellspacing="0"

    style="
        width:100%;
        border-collapse:collapse;
    "
>


<tr>

<td
    style="
        width:160px;
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Name
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>
    ${escapeHtml(name)}
</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Business Email
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>

<a
    href="mailto:${escapeHtml(
        email
    )}"
>
    ${escapeHtml(email)}
</a>

</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Company
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>

    ${escapeHtml(
        company ||
        "Not provided"
    )}

</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Role
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>

    ${escapeHtml(
        role ||
        "Not provided"
    )}

</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Phone
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>

    ${escapeHtml(
        phone ||
        "Not provided"
    )}

</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Source
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>
    ${escapeHtml(source)}
</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Submitted
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>
    ${escapeHtml(submittedAt)}
</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
        border-bottom:1px solid #E8EBF0;
    "
>
    Page
</td>

<td
    style="
        border-bottom:1px solid #E8EBF0;
    "
>

    ${escapeHtml(
        page ||
        "Not provided"
    )}

</td>

</tr>


<tr>

<td
    style="
        font-weight:700;
    "
>
    URL
</td>

<td>

${
    safeUrl
        ? `
            <a href="${safeUrl}">
                ${safeUrl}
            </a>
        `
        : "Not provided"
}

</td>

</tr>

</table>


<div
    style="
        margin-top:24px;
        padding:16px 18px;
        border-radius:10px;
        background:#F7F7FA;
        color:#667085;
        font-size:13px;
        line-height:1.6;
    "
>

    Click <strong>Reply</strong>
    in Outlook to respond directly to
    ${escapeHtml(name)}.

</div>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>
`;
}


/* ==========================================================================
   POST
   ========================================================================== */

export const POST =
    async ({
        request,
    }) => {

        let stage =
            "START";


        try {

            /* ==============================================================
               REQUEST
               ============================================================== */

            stage =
                "READ_REQUEST";


            const guard =
                await guardFormRequest(request);

            if (!guard.ok) {
                return guard.response;
            }

            const body =
                guard.body;


            const name =
                clean(
                    body?.name
                );


            const email =
                clean(
                    body?.email
                );


            const company =
                clean(
                    body?.company
                );


            const role =
                clean(
                    body?.role
                );


            const phone =
                clean(
                    body?.phone
                );


            const source =
                clean(
                    body?.source
                ) ||
                "contact page";


            const page =
                clean(
                    body?.page
                );


            const pageUrl =
                clean(
                    body?.url
                );


            /*
             * Hidden field used as bot trap.
             */
            const website =
                clean(
                    body?.website
                );


            /*
             * Timestamp created when
             * the form became available.
             */
            const startedAt =
                Number(
                    body?.startedAt
                );


            /* ==============================================================
               BOT PROTECTION
               ============================================================== */

            stage =
                "BOT_CHECK";


            /*
             * Real users never fill this field.
             */
            if (website) {
                /*
                 * Pretend success.
                 * Don't tell bots they were blocked.
                 */
                return jsonResponse({
                    success:
                        true,
                });
            }


            /*
             * Reject submissions happening
             * unrealistically quickly.
             *
             * 2 seconds minimum.
             */
            if (
                !Number.isFinite(
                    startedAt
                ) ||
                Date.now() -
                    startedAt <
                    2000
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Please wait a moment and submit the form again.",
                    },
                    400
                );
            }


            /*
             * Reject extremely old form sessions.
             *
             * 2 hours.
             */
            if (
                Date.now() -
                    startedAt >
                2 *
                    60 *
                    60 *
                    1000
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Your form session expired. Please refresh the page.",
                    },
                    400
                );
            }


            /* ==============================================================
               VALIDATION
               ============================================================== */

            stage =
                "VALIDATION";


            if (!name) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Name is required.",
                    },
                    400
                );
            }


            if (
                name.length >
                150
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Name is too long.",
                    },
                    400
                );
            }


            if (
                !email ||
                !isValidEmail(
                    email
                )
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Please provide a valid business email.",
                    },
                    400
                );
            }


            if (
                email.length >
                200
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Email is too long.",
                    },
                    400
                );
            }


            if (
                company.length >
                200
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Company name is too long.",
                    },
                    400
                );
            }


            if (
                role.length >
                150
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Role is too long.",
                    },
                    400
                );
            }


            if (
                phone.length >
                50
            ) {
                return jsonResponse(
                    {
                        success:
                            false,

                        message:
                            "Phone number is too long.",
                    },
                    400
                );
            }


            /* ==============================================================
               SAME ORIGIN CHECK
               ============================================================== */

            const origin =
                request.headers.get(
                    "Origin"
                );


            if (origin) {
                const requestOrigin =
                    new URL(
                        request.url
                    ).origin;


                if (
                    origin !==
                    requestOrigin
                ) {
                    return jsonResponse(
                        {
                            success:
                                false,

                            message:
                                "Invalid request origin.",
                        },
                        403
                    );
                }
            }


            /* ==============================================================
               MAIL CONFIGURATION
               ============================================================== */

            stage =
                "READ_ENV";


            const env =
                await getRuntimeEnv();


            const contactTo =
                clean(
                    env.CONTACT_TO_EMAIL
                );


            if (!contactTo || !isValidEmail(contactTo)) {
            // Not wired up yet (CONTACT_TO_EMAIL / MS_CLIENT_SECRET are set with
            // `wrangler secret put`). Tell the visitor where to write instead.
            return jsonResponse(
                {
                    success: false,
                    message: "The contact form is not live yet. Please email connect@revivetoday.com and we will reply directly.",
                },
                503
            );
        }


            /* ==============================================================
               BUILD MAIL
               ============================================================== */

            const submittedAt =
                new Date()
                    .toISOString();


            const html =
                createContactEmail({
                    name,
                    email,
                    company,
                    role,
                    phone,
                    source,
                    page,
                    pageUrl,
                    submittedAt,
                });


            const subject =
                "RE-ViVE Website Contact — " +
                name +
                (
                    company
                        ? ` — ${company}`
                        : ""
                );


            /* ==============================================================
               SEND
               ============================================================== */

            stage =
                "SEND_EMAIL";


            await sendMicrosoftMail({
                to:
                    contactTo,

                /*
                 * When you click Reply
                 * in Outlook it replies
                 * directly to visitor.
                 */
                replyTo:
                    email,

                subject,

                html,
            });


            /* ==============================================================
               SUCCESS
               ============================================================== */

            return jsonResponse({
                success:
                    true,

                message:
                    "Thank you. Your details have been sent successfully.",
            });

        } catch (
            error
        ) {

            console.error(
                "Contact API error:",
                {
                    stage,

                    message:
                        error?.message,

                    stack:
                        error?.stack,
                }
            );




            return jsonResponse(
                {
                    success:
                        false,

                    message:
                        "Unable to send your details. Please try again.",
                },
                500
            );
        }
    };