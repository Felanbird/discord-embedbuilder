import { EventEmitter } from "events";
import { TextChannel, User, MessageEmbed, MessageCollector, DMChannel } from "discord.js";

export interface PageUpdateOptions {
    /**
     * The initial message to send. Use %u to reference the user.
     */
    message: string;
    time: number;
    /**
     * Do you want to use a cancel message?
     */
    cancel: boolean;
    /**
     * If cancel is true, then this is the format the cancel message will follow.
     * Use %u to reference the user.
     */
    cancelFormat: string;
    /**
     * The message that is sent when it receives an invalid page.
     * Use %u to reference the user.
     */
    invalidPage: string;
    /**
     * The message sent when it has received a valid page.
     * Use %u to reference the user, %n to get the number they gave.
     */
    success: string;
}

/**
 * PageUpdater class
 * @noInheritDoc
 */
export class PageUpdater extends EventEmitter {
    private channel: TextChannel | DMChannel;
    private user: User;
    private embedArray: MessageEmbed[];
    private options?: PageUpdateOptions;
    /**
     * Create a PageUpdater to await a response from a user, and set the embedArray to the provided number.
     * ```javascript
     * const pageUpdater = new PageUpdater(message.channel, message.author, builder.getEmbeds());
     * pageUpdater.awaitPageUpdate()
     *  .on('cancel', (collector) => collector.stop())
     *  .on('page', (page) => builder.updatePage(page));
     * ```
     *
     * @param channel The channel to send messages to.
     * @param user The user this will be accepting messages from/
     * @param embedArray The array of embeds to use.
     * @param options Options such as messages, time, cancel.
     */
    constructor(channel: TextChannel | DMChannel, user: User, embedArray: MessageEmbed[], options?: PageUpdateOptions) {
        super();
        this.channel = channel;
        this.user = user;
        this.embedArray = embedArray;
        this.options = options;
    }
    /**
     * Awaits a page update.
     * @emits page
     * @emits invalid
     * @emits cancel
     */
    public awaitPageUpdate() {
        const pageUpdateOptions = this.options || {
            message: '%u Please pick a page to go to.',
            cancel: true,
            cancelFormat: '%u Successfully canceled request.',
            time: 10000,
            invalidPage: '%u Sorry, I could not find that page.',
            success: '%u Set the page to %n',
        };
        const cancel = pageUpdateOptions.cancel || true;
        const format = pageUpdateOptions.cancelFormat || '%u Successfully canceled request.';
        const time = pageUpdateOptions.time || 10000;
        const invalidPage = pageUpdateOptions.invalidPage || '%u Sorry, I could not find that page.';
        const success = pageUpdateOptions.success || '%u Set the page number to %n';
        const message = pageUpdateOptions.message || '%u Please pick a page to go to.';
        this.channel.send(message.replace('%u', `${this.user}`)).then(sent => {
            if (sent instanceof Array) sent = sent[0];
            const collector = sent.channel.createMessageCollector(msg => msg.author.id === this.user.id, {
                time: time,
            });
            collector.on('collect', response => {
                const page = parseInt(response.content);
                if (isNaN(page) && response.content.startsWith('cancel') && cancel) {
                    this.emit('cancel', collector, response.content);
                    response.channel.send(format.replace('%u', response.author));
                } else if (!isNaN(page)) {
                    if (page < 1 || page > this.embedArray.length) {
                        this.emit('invalid');
                        return response.channel.send(invalidPage.replace('%u', response.author));
                    }
                    this.emit('page', page, response.content, collector);
                    response.channel.send(success
                        .replace('%u', response.author)
                        .replace('%n', page.toString())
                    );
                } else {
                    this.emit('invalid', collector, response.content);
                    response.channel.send(invalidPage.replace('%u', response.author));
                }
            });
        });
        return this;
    }
}

export namespace PageUpdater {
    /**
     * Emitted when it has received a valid number.
     * @event page
     * @param page The page number received.
     * @param content The content that contained the page number.
     * @param collector The message collector.
     */
    declare function page(page: number, content: string, collector: MessageCollector): void;
    /**
     * Emitted when it has received an invalid number or page.
     * @event invalid
     * @param collector The message collector.
     * @param content The content that had an invalid response in it.
     */
    declare function invalid(collector: MessageCollector, content: string): void;
    /**
     * Emitted when it has been canceled or it has ended.
     * @event cancel
     * @param collector The message collector.
     * @param content The content that contained the cancel keyword.
     */
    declare function cancel(collector: MessageCollector, content: string): void;
}